import os
import time
import requests

VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
VT_URL = "https://www.virustotal.com/api/v3/files/{hash}"


def check_hash(sha256: str) -> dict:
    """
    Look up a single SHA256 hash on VirusTotal.
    Returns a simplified result dict, or empty dict on failure.
    """
    if not VIRUSTOTAL_API_KEY or not sha256:
        return {}

    try:
        response = requests.get(
            VT_URL.format(hash=sha256),
            headers={"x-apikey": VIRUSTOTAL_API_KEY},
            timeout=15,
        )

        if response.status_code == 404:
            return {"sha256": sha256, "vt_found": False}

        if response.status_code != 200:
            return {}

        data = response.json().get("data", {}).get("attributes", {})
        stats = data.get("last_analysis_stats", {})

        return {
            "sha256":           sha256,
            "vt_found":         True,
            "malicious":        stats.get("malicious", 0),
            "suspicious":       stats.get("suspicious", 0),
            "undetected":       stats.get("undetected", 0),
            "total_engines":    sum(stats.values()),
            "threat_label":     data.get("popular_threat_classification", {})
                                    .get("suggested_threat_label", ""),
            "vt_link":          f"https://www.virustotal.com/gui/file/{sha256}",
        }

    except requests.RequestException:
        return {}


def enrich_with_virustotal(log_entries: list) -> list:
    """
    For each log entry that has a sha256 field, look it up on VirusTotal
    and add vt_result to the entry.

    Free tier limit: 4 requests/minute — we add a 15s delay between calls.
    Only checks unique hashes to avoid redundant API calls.
    """
    if not VIRUSTOTAL_API_KEY:
        return log_entries

    # Collect unique non-empty sha256 hashes
    seen = set()
    hashes_to_check = []
    for entry in log_entries:
        h = entry.get("sha256", "")
        if h and h not in seen:
            seen.add(h)
            hashes_to_check.append(h)

    if not hashes_to_check:
        return log_entries

    # Look up each unique hash (respect free tier rate limit)
    vt_cache = {}
    for i, h in enumerate(hashes_to_check):
        vt_cache[h] = check_hash(h)
        if i < len(hashes_to_check) - 1:
            time.sleep(15)  # 4 requests/min = 1 per 15s

    # Enrich log entries with VT results
    for entry in log_entries:
        h = entry.get("sha256", "")
        if h and h in vt_cache:
            entry["vt_result"] = vt_cache[h]

    return log_entries
