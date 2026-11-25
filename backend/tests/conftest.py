"""
Shared fixtures for API route tests.

Every test gets a fresh app backed by in-memory SQLite. OpenAI and VirusTotal
are always mocked, so the suite needs no network, no API keys and costs nothing.
"""
import os
import tempfile

# Config reads the environment at import time, so set it before importing app.
# Explicit values also stop a local backend/.env from leaking into tests.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["OPENAI_API_KEY"] = "test-key-not-real"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-at-least-32-bytes-long"
os.environ["VIRUSTOTAL_API_KEY"] = ""
os.environ["UPLOAD_FOLDER"] = tempfile.mkdtemp(prefix="redwatch-test-uploads-")

from unittest.mock import MagicMock, patch  # noqa: E402

import pytest  # noqa: E402

from app import create_app, db  # noqa: E402

from tests.helpers import APACHE_LINES, FAKE_ANALYSIS  # noqa: E402


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def register(client):
    """Register a user and return (auth headers, user dict)."""
    def _register(username="analyst", email="analyst@example.com", password="S3cure-pass!"):
        res = client.post(
            "/api/auth/register",
            json={"username": username, "email": email, "password": password},
        )
        assert res.status_code == 201, res.get_json()
        body = res.get_json()
        return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]
    return _register


@pytest.fixture
def auth_headers(register):
    headers, _ = register()
    return headers


@pytest.fixture
def mock_analyzer():
    """Replace the OpenAI log analysis and the VirusTotal background thread."""
    with patch("app.routes.logs.analyze_with_openai", return_value=dict(FAKE_ANALYSIS)) as analyze, \
         patch("app.routes.logs.enrich_with_virustotal") as enrich:
        yield analyze, enrich


@pytest.fixture
def mock_openai_client():
    """Replace the assistant's OpenAI client; set .return_value text per test."""
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content="  Mocked AI answer.  "))
    ]
    with patch("app.routes.assistant.client", fake):
        yield fake


@pytest.fixture
def uploaded(client, auth_headers, mock_analyzer):
    """Upload a small Apache log and return the upload id."""
    import io
    res = client.post(
        "/api/logs/upload",
        headers=auth_headers,
        data={"file": (io.BytesIO(APACHE_LINES.encode()), "access.log")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 201, res.get_json()
    return res.get_json()["upload_id"]
