import csv
import gzip
import json
import re
from typing import List, Dict, Tuple

# Apache/Nginx Combined Log Format regex
# Example line:
# 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "http://ref.com" "Mozilla/5.0"
_APACHE_RE = re.compile(
    r'(?P<src_ip>\S+)\s+'                            # client IP
    r'\S+\s+'                                        # ident (always -)
    r'(?P<user>\S+)\s+'                              # auth user
    r'\[(?P<timestamp>[^\]]+)\]\s+'                  # [timestamp]
    r'"(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+'   # "METHOD /path HTTP/x"
    r'(?P<status_code>\d{3})\s+'                     # status code
    r'(?P<bytes_sent>\S+)'                           # bytes sent
    r'(?:\s+"(?P<referrer>[^"]*)"\s+"(?P<user_agent>[^"]*)")?'  # optional referrer + UA
)

# ZScaler field names used for fingerprinting
_ZSCALER_FIELDS = {"src_ip", "dst_ip", "threat_name", "bytes_sent", "bytes_received"}


# ---------------------------------------------------------------------------
# 5.1  Auto-detection
# ---------------------------------------------------------------------------

def detect_log_format(filepath: str) -> str:
    """
    Fingerprint the log file by reading its first 5 non-empty lines.
    Returns one of: 'zscaler' | 'apache' | 'json'
    Falls back to 'zscaler' when format is ambiguous.
    """
    opener = gzip.open if filepath.endswith(".gz") else open

    with opener(filepath, "rt", encoding="utf-8", errors="ignore") as f:
        head = [line.strip() for _, line in zip(range(5), f) if line.strip()]

    if not head:
        return "zscaler"

    # JSON: first non-empty line starts with {
    if head[0].startswith("{"):
        return "json"

    # Apache/Nginx: matches the Combined Log Format regex
    if _APACHE_RE.match(head[0]):
        return "apache"

    # ZScaler: header row contains known ZScaler field names
    first_lower = head[0].lower()
    if any(field in first_lower for field in _ZSCALER_FIELDS):
        return "zscaler"

    # Fall back to ZScaler (handles pipe-delimited variants too)
    return "zscaler"


# ---------------------------------------------------------------------------
# 5.7  Master dispatcher
# ---------------------------------------------------------------------------

def parse_log_file(filepath: str) -> Tuple[List[Dict], str]:
    """
    Detect the log format and route to the correct parser.
    Returns (entries, log_type) where log_type is 'zscaler' | 'apache' | 'json'.
    """
    fmt = detect_log_format(filepath)

    if fmt == "apache":
        return parse_apache_log(filepath), "apache"
    if fmt == "json":
        return parse_json_log(filepath), "json"
    return parse_zscaler_log(filepath), "zscaler"


# ---------------------------------------------------------------------------
# 5.2  ZScaler parser (with .gz support)
# ---------------------------------------------------------------------------

def parse_zscaler_log(filepath: str) -> List[Dict]:
    """
    Parse a ZScaler web proxy log (CSV or pipe-delimited, plain or .gz).
    Caps output at 500 entries to fit Claude's context window.
    """
    entries = []
    opener = gzip.open if filepath.endswith(".gz") else open

    with opener(filepath, "rt", encoding="utf-8", errors="ignore") as f:
        sample = f.read(2048)
        f.seek(0)
        delimiter = "|" if sample.count("|") > sample.count(",") else ","

        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            entries.append({
                # --- Core fields ---
                "timestamp":       _get(row, "timestamp"),
                "user":            _get(row, "user", "unknown"),
                "src_ip":          _get(row, "src_ip"),
                "dst_ip":          _get(row, "dst_ip"),
                "url":             _get(row, "url"),
                "action":          _get(row, "action"),
                "category":        _get(row, "category"),
                "bytes_sent":      _int(row, "bytes_sent"),
                "bytes_received":  _int(row, "bytes_received"),
                "status_code":     _int(row, "status_code"),
                "threat":          _get(row, "threat_name"),
                "duration_ms":     _int(row, "duration_ms"),
                # --- High-value security fields ---
                "risk_score":      _int(row, "riskscore"),
                "sha256":          _get(row, "sha256"),
                "file_hash_md5":   _get(row, "bamd5"),
                "dlp_dict":        _get(row, "dlpdict"),
                "app_name":        _get(row, "appname"),
                "device_hostname": _get(row, "devicehostname"),
            })

    return entries[:500]


# ---------------------------------------------------------------------------
# 5.3  Apache / Nginx Combined Log Format parser (with .gz support)
# ---------------------------------------------------------------------------

def parse_apache_log(filepath: str) -> List[Dict]:
    """
    Parse Apache/Nginx Combined Log Format lines (plain or .gz).
    Normalises fields to the same schema used by the ZScaler parser so that
    Claude's prompt works unchanged across all log types.
    """
    entries = []
    opener = gzip.open if filepath.endswith(".gz") else open

    with opener(filepath, "rt", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            m = _APACHE_RE.match(line)
            if not m:
                continue

            status = int(m.group("status_code"))
            raw_bytes = m.group("bytes_sent")

            entries.append({
                "timestamp":      m.group("timestamp"),
                "user":           m.group("user") if m.group("user") != "-" else "unknown",
                "src_ip":         m.group("src_ip"),
                "dst_ip":         "",                          # not present in Apache logs
                "url":            m.group("path"),
                "action":         "Allow" if status < 400 else "Block",
                "category":       "",
                "bytes_sent":     int(raw_bytes) if raw_bytes.isdigit() else 0,
                "bytes_received": 0,
                "status_code":    status,
                "threat":         "",
                "duration_ms":    0,
                "method":         m.group("method"),
                "user_agent":     m.group("user_agent") or "",
            })

            if len(entries) >= 500:
                break

    return entries


# ---------------------------------------------------------------------------
# 5.4  JSON / NDJSON application log parser (with .gz support)
# ---------------------------------------------------------------------------

def parse_json_log(filepath: str) -> List[Dict]:
    """
    Parse NDJSON logs (one JSON object per line, plain or .gz).
    Uses smart key normalisation to map common field names to a unified schema
    so downstream code and Claude's prompt stay format-agnostic.
    """
    entries = []
    opener = gzip.open if filepath.endswith(".gz") else open

    with opener(filepath, "rt", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            entries.append({
                "timestamp":      _jget(obj, ["timestamp", "time", "@timestamp", "ts"]),
                "user":           _jget(obj, ["user", "user_id", "username", "actor"], "unknown"),
                "src_ip":         _jget(obj, ["src_ip", "ip", "remote_addr", "client_ip", "sourceIp"]),
                "dst_ip":         _jget(obj, ["dst_ip", "dest_ip", "destination", "destinationIp"]),
                "url":            _jget(obj, ["url", "uri", "path", "request_url"]),
                "action":         _jget(obj, ["action", "event_type", "type"]),
                "category":       _jget(obj, ["category", "type", "event_category"]),
                "bytes_sent":     _jint(obj, ["bytes_sent", "bytes", "size", "response_size"]),
                "bytes_received": _jint(obj, ["bytes_received", "bytes_in", "request_size"]),
                "status_code":    _jint(obj, ["status_code", "status", "http_status", "response_code"]),
                "threat":         _jget(obj, ["threat", "threat_name", "malware", "signature"]),
                "duration_ms":    _jint(obj, ["duration_ms", "duration", "elapsed", "latency"]),
                # Hash fields — used for VirusTotal enrichment
                "sha256":         _jget(obj, ["sha256", "file_hash", "hash", "sha256_hash",
                                              "filehash", "file_sha256", "checksum"]),
                "file_hash_md5":  _jget(obj, ["md5", "file_md5", "md5_hash", "file_hash_md5"]),
            })

            if len(entries) >= 500:
                break

    return entries


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(row: dict, key: str, default: str = "") -> str:
    """Safely get a string from a CSV DictReader row."""
    return (row.get(key) or default).strip()


def _int(row: dict, key: str) -> int:
    """Safely parse an int from a CSV DictReader row."""
    try:
        return int(row.get(key) or 0)
    except (ValueError, TypeError):
        return 0


def _jget(obj: dict, keys: list, default: str = "") -> str:
    """Try multiple key names and return the first match as a string."""
    for k in keys:
        v = obj.get(k)
        if v is not None:
            return str(v).strip()
    return default


def _jint(obj: dict, keys: list) -> int:
    """Try multiple key names and return the first match as an int."""
    for k in keys:
        v = obj.get(k)
        if v is not None:
            try:
                return int(v)
            except (ValueError, TypeError):
                return 0
    return 0
