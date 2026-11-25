"""Shared test data for the API route tests."""

FAKE_ANALYSIS = {
    "summary": "Suspicious SQL injection attempts from 198.51.100.55.",
    "total_events": 3,
    "threat_level": "high",
    "key_findings": ["SQL injection attempt against /api/users"],
    "timeline": [{"time": "14:05", "event": "DROP TABLE attempt"}],
    "anomalies": [
        {"severity": "high", "type": "sql_injection", "description": "DROP TABLE in query string"},
    ],
}

APACHE_LINES = (
    '10.0.0.1 - - [06/Mar/2026:09:00:01 -0500] "GET /index.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0"\n'
    '10.0.0.2 - - [06/Mar/2026:09:00:02 -0500] "GET /about HTTP/1.1" 200 512 "-" "Mozilla/5.0"\n'
    '198.51.100.55 - - [06/Mar/2026:14:05:35 -0500] "GET /api/users?id=1;DROP+TABLE+users HTTP/1.1" 400 512 "-" "curl/7.88.1"\n'
)
