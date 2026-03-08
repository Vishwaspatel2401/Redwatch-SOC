import json
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are an expert SOC (Security Operations Center) analyst.
You analyze web proxy log data and identify security threats, anomalies,
and patterns that require attention.

Always respond with ONLY valid JSON matching this exact schema:
{
  "summary": "string - executive summary for SOC team (2-3 sentences)",
  "threat_level": "low|medium|high|critical",
  "total_events": number,
  "key_findings": ["string"],
  "timeline": [
    {"time": "HH:MM", "event": "string", "severity": "info|warn|critical"}
  ],
  "anomalies": [
    {
      "id": "string",
      "type": "string (e.g. ip_burst, data_exfil, malware_contact)",
      "description": "string - what was observed",
      "reason": "string - why it is suspicious",
      "affected_users": ["string"],
      "affected_ips": ["string"],
      "confidence": 0.0,
      "severity": "low|medium|high|critical",
      "log_indices": [0]
    }
  ]
}

Confidence score guide:
- 1.0   : threat_name field is populated (confirmed malware)
- 0.85+ : category is Malware/Phishing with a blocked action
- 0.70+ : statistical anomaly (burst, exfil) with corroborating signals
- 0.50+ : behavioral anomaly (after-hours access) with limited context
- <0.50 : weak signal, included for visibility only

Do not include markdown, backticks, or any text outside the JSON object.
"""


def _compact(entry: dict) -> dict:
    """Strip null/empty fields to reduce token count."""
    return {k: v for k, v in entry.items() if v not in (None, "", 0, [], {})}


def _sample(entries: list, n: int = 500) -> list:
    """Evenly sample n entries across the full list so no part of the file is skipped."""
    if len(entries) <= n:
        return entries
    step = len(entries) / n
    return [entries[int(i * step)] for i in range(n)]


def analyze_with_openai(log_entries: list) -> dict:
    """
    Send a representative sample of log entries to GPT-4o-mini for threat analysis.
    Samples evenly across the full file so the entire log is covered.
    Returns a structured dict with summary, threat_level, timeline, and anomalies.
    """
    sampled = _sample(log_entries, 500)
    compact_entries = [_compact(e) for e in sampled]
    logs_json = json.dumps(compact_entries, separators=(",", ":"))

    user_prompt = f"""
Analyze the following {len(log_entries)} web proxy log entries (evenly sampled across the full file).

Look for:
- Unusual request volumes from single IPs (potential DDoS or scraping)
- Access to known malware/phishing domains (check categories)
- Large data transfers (bytes_sent > 10MB may indicate exfiltration)
- Access outside business hours (before 07:00 or after 20:00)
- Blocked requests followed by retries (persistence / beaconing)
- Lateral movement patterns
- Populated threat_name fields (confirmed malware detections)

LOG DATA:
{logs_json}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=4096,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    return json.loads(raw)
