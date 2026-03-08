# RedWatch — SOC Log Analyzer

A full-stack cybersecurity platform for uploading and analyzing web proxy, server, and application logs. Uses OpenAI GPT-4o-mini to detect anomalies, identify threats, and generate SOC analyst summaries with confidence scores. Optionally enriches analysis with VirusTotal hash lookups.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.x / 5.x |
| Frontend | Vite | 5.x |
| Frontend | Tailwind CSS + shadcn/ui | 3.x |
| Frontend | TanStack Query | 5.x |
| Frontend | Recharts | 2.x |
| Frontend | React Router | 6.x |
| Backend | Python + Flask | 3.11+ / 3.0 |
| Backend | SQLAlchemy | via Flask-SQLAlchemy (tables auto-created on boot) |
| Backend | Flask-JWT-Extended + Bcrypt | 4.x / 1.x |
| AI | OpenAI GPT-4o-mini | via openai SDK ≥1.50 |
| Threat Intel | VirusTotal API v3 | Optional |
| Database | PostgreSQL | 16.x |

---

## Architecture

3-tier architecture. The React frontend communicates exclusively with the Flask REST API. No AI calls are made from the frontend.

```
User → React (Vite) → Flask REST API → OpenAI GPT-4o-mini
                                     → VirusTotal API (background, optional)
                                     → PostgreSQL
```

**Upload flow:**
1. User authenticates → Flask issues a 24h JWT token
2. User uploads a log file (`.log`, `.txt`, `.csv`, `.json`, `.ndjson`, `.gz`)
3. Frontend sends file as `multipart/form-data` to `POST /api/logs/upload`
4. Backend auto-detects format (ZScaler CSV / Apache Combined Log / JSON/NDJSON)
5. Parses up to 500 log events into a normalised schema
6. Sends parsed logs to OpenAI GPT-4o-mini with a structured SOC analyst prompt
7. VirusTotal SHA256 hash lookups run **in a background thread** (non-blocking)
8. Results (anomalies, threat level, timeline, summary) are persisted to PostgreSQL
9. Frontend renders the dashboard, alerts, and AI assistant

---

## Quick Start (Docker) ⚡

The fastest way to run the full stack — PostgreSQL, backend, and frontend all start together.

```bash
git clone https://github.com/your-username/redwatch-soc
cd redwatch-soc

# 1. Set your API keys
cp .env.example .env
# Edit .env and set OPENAI_API_KEY and JWT_SECRET_KEY

# 2. Start everything
docker-compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

To stop:
```bash
docker-compose down
```

To wipe the database too:
```bash
docker-compose down -v
```

---

## Manual Setup (without Docker)

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+ and pip
- PostgreSQL 16 running locally
- OpenAI API key — [platform.openai.com](https://platform.openai.com)
- _(Optional)_ VirusTotal API key — [virustotal.com/gui/my-apikey](https://www.virustotal.com/gui/my-apikey)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/redwatch-soc
cd redwatch-soc
```

### 2. PostgreSQL — create the database and user

```bash
psql -U postgres
```

```sql
CREATE USER soc_user WITH PASSWORD 'soc_password';
CREATE DATABASE soc_db OWNER soc_user;
GRANT ALL PRIVILEGES ON DATABASE soc_db TO soc_user;
\q
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://soc_user:soc_password@localhost:5432/soc_db
JWT_SECRET_KEY=change-this-to-a-random-64-char-string
OPENAI_API_KEY=sk-your-openai-key-here
FLASK_ENV=development
UPLOAD_FOLDER=/tmp/uploads

# Optional — enables SHA256 hash lookups for ZScaler logs
VIRUSTOTAL_API_KEY=your-vt-key-here
```

Start the backend (runs on port 8000):

```bash
python main.py
```

### 4. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the frontend (runs on port 3000):

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Sample Log Files

Three sample files are provided in `sample-logs/` for testing:

| File | Format | Events | Notable anomalies |
|------|--------|--------|-------------------|
| `zscaler_sample.csv` | ZScaler Web Proxy CSV | 20 | Malware C2 beacons, data exfiltration (92 MB upload), phishing access, exploit kit download |
| `apache_sample.log` | Apache Combined Log | 25 | SQL injection via sqlmap, brute force login, Nikto scanner, sensitive file reconnaissance |
| `app_sample.ndjson` | JSON/NDJSON | 20 | Brute force → successful login, large data exports (95 MB), admin actions at midnight, SQL injection |

Upload any of these files to verify end-to-end analysis is working.

---

## AI Model & Approach

**Model:** `gpt-4o-mini` via OpenAI Chat Completions API
**Location:** `backend/app/services/ai_analyzer.py`
**Temperature:** `0.2` (low randomness for consistent results)
**Max tokens:** `4096`
**Response format:** `json_object` (structured JSON only, no markdown)

**Input:** Up to 500 parsed log entries serialised as JSON
**Output:** Structured JSON with:
- `summary` — 2–3 sentence executive summary for the SOC team
- `threat_level` — `low | medium | high | critical`
- `timeline` — chronological list of key events with severity
- `anomalies[]` — each containing:
  - `type`, `description`, `reason` (why it's suspicious)
  - `affected_ips`, `affected_users`
  - `confidence` (0.0–1.0)
  - `severity` — `low | medium | high | critical`

**What GPT looks for:**
- Unusual request volumes from a single IP (DDoS / scraping)
- Access to known malware or phishing domains
- Large data transfers (`bytes_sent > 10MB` — potential exfiltration)
- Access outside business hours (before 07:00 or after 20:00)
- Blocked requests followed by retries (persistence / beaconing)
- Lateral movement patterns
- Populated `threat_name` fields (confirmed malware from ZScaler)

### Confidence Score Guide

| Score | Meaning |
|-------|---------|
| 1.0 | `threat_name` populated — confirmed malware detection |
| 0.85–0.99 | Category is Malware/Phishing with a blocked action |
| 0.70–0.84 | Statistical anomaly with corroborating signals |
| 0.50–0.69 | Behavioural anomaly (e.g. after-hours) with limited context |
| < 0.50 | Weak signal, included for visibility only |

---

## VirusTotal Integration (Optional)

When `VIRUSTOTAL_API_KEY` is set, the backend enriches log entries that contain a `sha256` field (present in ZScaler logs) by checking each unique hash against VirusTotal's 70+ AV engine database.

- Runs **in a background thread** — does not block the upload response
- Only unique hashes are checked (deduplication)
- Free tier: 4 requests/minute (15s sleep between calls)
- Results feed into GPT's input context for higher-confidence detections
- Apache and JSON logs (no SHA256 fields) are unaffected

---

## API Endpoints

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create a new user account |
| POST | `/login` | No | Returns JWT access token |
| GET | `/me` | JWT | Get current user profile |

### Logs — `/api/logs`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload` | JWT | Upload a log file and trigger analysis |
| GET | `/` | JWT | List all uploads for the current user |
| GET | `/<upload_id>` | JWT | Get full analysis results for an upload |
| DELETE | `/<upload_id>` | JWT | Delete an upload and its results |

### AI Assistant — `/api/assistant`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat` | JWT | Ask GPT-4o-mini questions about a specific upload |

---

## Database Schema

**`users`**
- `id` (UUID PK), `username`, `email`, `password_hash` (bcrypt), `created_at`

**`log_uploads`**
- `id` (UUID PK), `user_id` (FK → users), `filename`, `file_size`, `log_type`, `status`, `uploaded_at`

**`analysis_results`**
- `id` (UUID PK), `upload_id` (FK → log_uploads), `summary`, `threat_level`, `total_events`, `flagged_events`, `key_findings` (JSON), `timeline_json` (JSON), `anomalies_json` (JSON), `events_sample` (JSON), `raw_response`, `analyzed_at`

Tables are **auto-created on first boot** via `db.create_all()` in the app factory. No migration commands needed.

---

## Project Structure

```
redwatch-soc/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx     # Charts, metrics, history panel
│       │   ├── UploadPage.tsx        # File upload + upload history
│       │   ├── AlertsPage.tsx        # Anomaly cards with confidence scores
│       │   ├── ReportsPage.tsx       # Incident report generation + PDF export
│       │   └── LandingPage.tsx       # Public marketing homepage
│       ├── components/
│       │   ├── AppLayout.tsx         # Sidebar navigation + theme toggle
│       │   └── ChatBubble.tsx        # A.R.I.A. floating AI assistant widget
│       ├── contexts/
│       │   ├── AuthContext.tsx       # JWT auth state + RequireAuth guard
│       │   └── ThemeContext.tsx      # Dark/light mode + localStorage persistence
│       └── lib/
│           └── api.ts                # Typed API client (fetch + JWT)
├── backend/
│   └── app/
│       ├── models.py                 # SQLAlchemy models
│       ├── config.py                 # Environment config
│       ├── routes/
│       │   ├── auth.py               # /api/auth/*
│       │   ├── logs.py               # /api/logs/*
│       │   └── assistant.py          # /api/assistant/*
│       └── services/
│           ├── log_parser.py         # Auto-detect + parse ZScaler/Apache/JSON
│           ├── ai_analyzer.py        # OpenAI GPT-4o-mini integration
│           └── virustotal.py         # VirusTotal SHA256 enrichment
├── sample-logs/
│   ├── zscaler_sample.csv
│   ├── apache_sample.log
│   └── app_sample.ndjson
└── README.md
```

---

## Supported Log Formats

| Format | Detection method | Key fields extracted |
|--------|-----------------|----------------------|
| ZScaler Web Proxy (CSV) | Header row contains `src_ip` + `url` columns | IP, URL, bytes, action, category, sha256, threat_name |
| Apache / Nginx Combined Log | Regex match on `IP - user [timestamp] "METHOD /path" status bytes` | IP, method, path, status code, bytes |
| JSON / NDJSON | One JSON object per line | Any common field names (normalised automatically) |
| `.gz` compressed | Auto-decompressed before format detection | All of the above |
