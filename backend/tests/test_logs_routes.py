"""Tests for /api/logs — upload, analysis storage, listing, access control, delete."""
import gzip
import io

from app.models import LogUpload
from tests.helpers import APACHE_LINES, FAKE_ANALYSIS


def _upload(client, headers, content: bytes, filename: str):
    return client.post(
        "/api/logs/upload",
        headers=headers,
        data={"file": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
    )


class TestUpload:
    def test_requires_auth(self, client):
        res = _upload(client, {}, APACHE_LINES.encode(), "access.log")
        assert res.status_code == 401

    def test_parses_analyzes_and_stores_result(self, client, auth_headers, mock_analyzer):
        analyze, enrich = mock_analyzer
        res = _upload(client, auth_headers, APACHE_LINES.encode(), "access.log")

        assert res.status_code == 201
        result = res.get_json()["result"]
        assert result["status"] == "complete"
        assert result["log_type"] == "apache"
        assert result["threat_level"] == FAKE_ANALYSIS["threat_level"]
        assert result["flagged_events"] == len(FAKE_ANALYSIS["anomalies"])
        assert len(result["events"]) == 3

        # The analyzer receives the parsed entries, not the raw file
        parsed = analyze.call_args.args[0]
        assert len(parsed) == 3
        assert parsed[2]["src_ip"] == "198.51.100.55"

    def test_gzipped_upload_is_parsed(self, client, auth_headers, mock_analyzer):
        """The frontend gzips uploads so attack strings don't trip the host WAF."""
        res = _upload(client, auth_headers, gzip.compress(APACHE_LINES.encode()), "access.log.gz")
        assert res.status_code == 201
        result = res.get_json()["result"]
        assert result["log_type"] == "apache"
        assert len(result["events"]) == 3

    def test_missing_file_rejected(self, client, auth_headers):
        res = client.post("/api/logs/upload", headers=auth_headers, data={}, content_type="multipart/form-data")
        assert res.status_code == 400

    def test_disallowed_extension_rejected(self, client, auth_headers, mock_analyzer):
        res = _upload(client, auth_headers, b"MZ\x90\x00", "malware.exe")
        assert res.status_code == 400
        mock_analyzer[0].assert_not_called()

    def test_analyzer_failure_marks_upload_as_error(self, app, client, auth_headers, mock_analyzer):
        mock_analyzer[0].side_effect = RuntimeError("OpenAI is down")
        res = _upload(client, auth_headers, APACHE_LINES.encode(), "access.log")

        assert res.status_code == 500
        assert "OpenAI is down" in res.get_json()["error"]
        with app.app_context():
            assert LogUpload.query.one().status == "error"


class TestListAndGet:
    def test_list_requires_auth(self, client):
        assert client.get("/api/logs/").status_code == 401

    def test_list_empty_for_new_user(self, client, auth_headers):
        res = client.get("/api/logs/", headers=auth_headers)
        assert res.status_code == 200
        assert res.get_json()["uploads"] == []

    def test_list_includes_upload_with_summary(self, client, auth_headers, uploaded):
        uploads = client.get("/api/logs/", headers=auth_headers).get_json()["uploads"]
        assert [u["id"] for u in uploads] == [uploaded]
        assert uploads[0]["threat_level"] == FAKE_ANALYSIS["threat_level"]

    def test_get_returns_full_analysis(self, client, auth_headers, uploaded):
        res = client.get(f"/api/logs/{uploaded}", headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()
        assert body["summary"] == FAKE_ANALYSIS["summary"]
        assert body["anomalies"] == FAKE_ANALYSIS["anomalies"]
        assert body["key_findings"] == FAKE_ANALYSIS["key_findings"]

    def test_get_unknown_id_is_404(self, client, auth_headers):
        assert client.get("/api/logs/does-not-exist", headers=auth_headers).status_code == 404


class TestIsolationAndDelete:
    def test_other_user_cannot_see_upload(self, client, register, uploaded):
        other, _ = register(username="mallory", email="mallory@example.com")
        assert client.get(f"/api/logs/{uploaded}", headers=other).status_code == 404
        assert client.get("/api/logs/", headers=other).get_json()["uploads"] == []

    def test_other_user_cannot_delete_upload(self, client, register, auth_headers, uploaded):
        other, _ = register(username="mallory", email="mallory@example.com")
        assert client.delete(f"/api/logs/{uploaded}", headers=other).status_code == 404
        assert client.get(f"/api/logs/{uploaded}", headers=auth_headers).status_code == 200

    def test_owner_can_delete_upload(self, client, auth_headers, uploaded):
        assert client.delete(f"/api/logs/{uploaded}", headers=auth_headers).status_code == 200
        assert client.get(f"/api/logs/{uploaded}", headers=auth_headers).status_code == 404
