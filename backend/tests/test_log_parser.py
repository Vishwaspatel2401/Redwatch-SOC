"""
Tests for log_parser.py — format detection and field extraction.

Each test is tagged with the MITRE technique it exercises so Tagref can
verify that the detection logic, this test, and the MITRE docs never drift
apart. See docs/mitre-mappings.md for technique definitions.
"""
import os
import csv
import json
import tempfile
import pytest

from app.services.log_parser import (
    detect_log_format,
    parse_zscaler_log,
    parse_apache_log,
    parse_json_log,
    parse_log_file,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

ZSCALER_HEADER = (
    "timestamp,user,src_ip,dst_ip,url,action,category,"
    "bytes_sent,bytes_received,status_code,threat_name,"
    "duration_ms,riskscore,sha256,bamd5,dlpdict,appname,devicehostname"
)

BEACONING_ROW = (  # [ref:T1071_beaconing]
    "2026-03-06 02:34:11,john.doe@corp.com,192.168.1.101,185.220.101.45,"
    "https://malware-c2.ru/beacon,Block,Malware Sites,"
    "520,0,403,Win32.Trojan.Beacon,150,95,"
    "a3f1c2d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2,"
    "d41d8cd98f00b204e9800998ecf8427e,,,LAPTOP-JD01"
)

EXFIL_ROW = (  # [ref:T1048_exfil]
    "2026-03-06 03:10:00,jane.smith@corp.com,192.168.1.102,203.0.113.50,"
    "https://unknown-bucket.io/upload,Allow,Unknown,"
    "15000000,200,200,,8200,55,,,,,LAPTOP-JS02"
)

AFTER_HOURS_ROW = (  # [ref:T1078_valid_accounts]
    "2026-03-06 01:45:00,attacker@corp.com,10.0.0.9,10.0.0.1,"
    "https://internal-wiki/sensitive,Allow,Business Applications,"
    "4200,98000,200,,310,20,,,,,DESKTOP-ATK"
)

NORMAL_ROW = (
    "2026-03-06 09:00:00,alice@corp.com,192.168.1.50,142.250.80.46,"
    "https://google.com,Allow,Search Engines,"
    "1000,40000,200,,120,5,,,,,LAPTOP-A01"
)


def _zscaler_file(*extra_rows: str) -> str:
    """Write a temp ZScaler CSV and return its path."""
    rows = [ZSCALER_HEADER] + list(extra_rows)
    f = tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8"
    )
    f.write("\n".join(rows) + "\n")
    f.close()
    return f.name


def _apache_file(*lines: str) -> str:
    f = tempfile.NamedTemporaryFile(
        mode="w", suffix=".log", delete=False, encoding="utf-8"
    )
    f.write("\n".join(lines) + "\n")
    f.close()
    return f.name


def _json_file(*objects: dict) -> str:
    f = tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    )
    for obj in objects:
        f.write(json.dumps(obj) + "\n")
    f.close()
    return f.name


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

class TestDetectLogFormat:
    def test_detects_zscaler_by_header(self):
        path = _zscaler_file(NORMAL_ROW)
        try:
            assert detect_log_format(path) == "zscaler"
        finally:
            os.unlink(path)

    def test_detects_apache_by_regex(self):
        line = '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326'
        path = _apache_file(line)
        try:
            assert detect_log_format(path) == "apache"
        finally:
            os.unlink(path)

    def test_detects_json_by_first_char(self):
        path = _json_file({"timestamp": "2026-01-01", "src_ip": "1.2.3.4"})
        try:
            assert detect_log_format(path) == "json"
        finally:
            os.unlink(path)


# ---------------------------------------------------------------------------
# ZScaler parser — beaconing signals  [ref:T1071_beaconing]
# ---------------------------------------------------------------------------

class TestZScalerBeaconing:
    """
    Verifies that a log entry matching C2 beaconing characteristics is parsed
    with the fields the AI analyzer needs to flag it. See [ref:T1071_beaconing].
    """

    def setup_method(self):
        self.path = _zscaler_file(BEACONING_ROW)
        self.entries = parse_zscaler_log(self.path)

    def teardown_method(self):
        os.unlink(self.path)

    def test_parses_one_entry(self):
        assert len(self.entries) == 1

    def test_action_is_block(self):
        assert self.entries[0]["action"] == "Block"

    def test_threat_name_populated(self):
        assert self.entries[0]["threat"] == "Win32.Trojan.Beacon"

    def test_risk_score_high(self):
        assert self.entries[0]["risk_score"] >= 80

    def test_sha256_extracted(self):
        assert len(self.entries[0]["sha256"]) == 64

    def test_src_ip_extracted(self):
        assert self.entries[0]["src_ip"] == "192.168.1.101"


# ---------------------------------------------------------------------------
# ZScaler parser — exfiltration signals  [ref:T1048_exfil]
# ---------------------------------------------------------------------------

class TestZScalerExfiltration:
    """
    Verifies that a large-bytes-sent entry is parsed correctly so the AI
    analyzer can apply the 10 MB threshold rule. See [ref:T1048_exfil].
    """

    def setup_method(self):
        self.path = _zscaler_file(EXFIL_ROW)
        self.entries = parse_zscaler_log(self.path)

    def teardown_method(self):
        os.unlink(self.path)

    def test_bytes_sent_is_int(self):
        assert isinstance(self.entries[0]["bytes_sent"], int)

    def test_bytes_sent_exceeds_threshold(self):
        assert self.entries[0]["bytes_sent"] > 10_000_000

    def test_category_preserved(self):
        assert self.entries[0]["category"] == "Unknown"


# ---------------------------------------------------------------------------
# ZScaler parser — after-hours valid account  [ref:T1078_valid_accounts]
# ---------------------------------------------------------------------------

class TestZScalerAfterHours:
    """
    Verifies that authenticated after-hours access is parsed with a real user
    field so the AI analyzer can surface it as a T1078 anomaly.
    See [ref:T1078_valid_accounts].
    """

    def setup_method(self):
        self.path = _zscaler_file(AFTER_HOURS_ROW)
        self.entries = parse_zscaler_log(self.path)

    def teardown_method(self):
        os.unlink(self.path)

    def test_user_not_unknown(self):
        assert self.entries[0]["user"] != "unknown"
        assert "@" in self.entries[0]["user"]

    def test_action_is_allow(self):
        assert self.entries[0]["action"] == "Allow"

    def test_timestamp_preserved(self):
        ts = self.entries[0]["timestamp"]
        hour = int(ts.split(" ")[1].split(":")[0])
        assert hour < 7 or hour > 20


# ---------------------------------------------------------------------------
# parse_log_file dispatcher
# ---------------------------------------------------------------------------

class TestDispatcher:
    def test_returns_zscaler_type(self):
        path = _zscaler_file(NORMAL_ROW)
        try:
            entries, log_type = parse_log_file(path)
            assert log_type == "zscaler"
            assert len(entries) == 1
        finally:
            os.unlink(path)

    def test_returns_json_type(self):
        path = _json_file({"timestamp": "2026-01-01", "src_ip": "1.2.3.4", "action": "Allow"})
        try:
            entries, log_type = parse_log_file(path)
            assert log_type == "json"
        finally:
            os.unlink(path)
