# MITRE ATT&CK Mappings

This document defines the attack techniques RedWatch detects.
Each tag is cross-referenced from the detection logic and its test using
[Tagref](https://github.com//stepchowfun/tagref), so renaming or removing
a technique here will break CI until every reference is updated.

---

## [tag:T1071_beaconing] — Application Layer Protocol: Beaconing (T1071)

Adversaries communicate with C2 infrastructure over standard web protocols
to blend with normal traffic. RedWatch flags repeated blocked requests to the
same destination within a short window.

**Signals in log data:**
- `action = Block` followed by retries to the same `dst_ip` or `url`
- High `risk_score` (≥ 80) with a populated `threat_name`
- Short, regular `duration_ms` intervals (automated cadence)

**References:** detection logic [ref:T1071_beaconing], parser [ref:T1071_beaconing], tests [ref:T1071_beaconing]

---

## [tag:T1048_exfil] — Exfiltration Over Web Service (T1048)

Adversaries exfiltrate data over existing web channels to avoid triggering
dedicated exfiltration monitors. RedWatch flags unusually large outbound transfers.

**Signals in log data:**
- `bytes_sent` > 10,000,000 (10 MB) in a single request
- Destination is uncategorised or `category = Unknown`
- Occurs outside business hours (before 07:00 or after 20:00)

**References:** detection logic [ref:T1048_exfil], parser [ref:T1048_exfil], tests [ref:T1048_exfil]

---

## [tag:T1078_valid_accounts] — Valid Accounts: After-Hours Access (T1078)

Compromised credentials are used to access resources during off-hours when
legitimate users are unlikely to be active. RedWatch surfaces these as anomalies.

**Signals in log data:**
- Authenticated `user` field present (not `unknown`)
- `timestamp` hour < 07 or > 20
- `action = Allow` (access succeeded — no block to rely on)

**References:** detection logic [ref:T1078_valid_accounts], tests [ref:T1078_valid_accounts]
