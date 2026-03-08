const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getToken(): string | null {
  return localStorage.getItem("redwatch_token");
}

export function setToken(token: string) {
  localStorage.setItem("redwatch_token", token);
}

export function clearToken() {
  localStorage.removeItem("redwatch_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || err.message || "Request failed");
  }

  return res.json();
}

// Auth (backend: username, password / username, email, password; returns access_token)
export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; user: unknown }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username: email, password }),
    }
  );
  setToken(data.access_token);
  return data;
}

export async function register(email: string, password: string) {
  const data = await request<{ access_token: string; user: unknown }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ username: email, email, password }),
    }
  );
  setToken(data.access_token);
  return { token: data.access_token };
}

// Logs (backend: GET /api/logs/ -> { uploads }, POST /api/logs/upload -> { upload_id, result }, GET /api/logs/:id -> merged upload+result)
export async function getUploads(): Promise<Upload[]> {
  const data = await request<{ uploads: RawUpload[] }>("/api/logs/");
  return (data.uploads || []).map((u) => ({
    id: u.id!,
    filename: u.filename || "",
    uploaded_at: u.uploaded_at || "",
    status: u.status || "complete",
    event_count: u.total_events,
    anomaly_count: u.flagged_events,
    threat_level: u.threat_level,
  }));
}

export async function uploadLogFile(file: File): Promise<Upload> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await request<{
    upload_id: string;
    result: RawUpload & RawResult;
  }>("/api/logs/upload", {
    method: "POST",
    body: formData,
  });
  const r = data.result;
  return {
    id: data.upload_id,
    filename: r.filename || "",
    uploaded_at: r.uploaded_at || new Date().toISOString(),
    status: r.status || "complete",
    event_count: r.total_events,
    anomaly_count: r.flagged_events,
    threat_level: r.threat_level,
  };
}

export async function getUploadDetails(id: string): Promise<UploadDetails> {
  const r = await request<RawUpload & RawResult>(`/api/logs/${id}`);
  const events: LogEvent[] = (r.events || []).map((e) => ({
    timestamp: e.timestamp || "",
    source_ip: e.src_ip || "",
    url: e.url,
    status_code: e.status_code,
  }));
  const anomalies: Anomaly[] = (r.anomalies || []).map((a: RawAnomaly) => ({
    id: a.id || "",
    rule: a.type || "",
    severity: (a.severity || "low") as "critical" | "high" | "medium" | "low",
    description: a.description || "",
    reason: a.reason || "",
    affected_ips: a.affected_ips || [],
    event_count: 1,
    confidence: a.confidence ?? null,
  }));
  const statusCodes: Record<string, number> = {};
  events.forEach((e) => {
    const s = String(e.status_code ?? 0);
    statusCodes[s] = (statusCodes[s] || 0) + 1;
  });
  const ipCount: Record<string, number> = {};
  events.forEach((e) => {
    ipCount[e.source_ip] = (ipCount[e.source_ip] || 0) + 1;
  });
  const ruleCount: Record<string, number> = {};
  anomalies.forEach((a) => {
    ruleCount[a.rule] = (ruleCount[a.rule] || 0) + 1;
  });
  return {
    events,
    anomalies,
    summary: {
      total_events: r.total_events ?? 0,
      unique_ips: new Set(events.map((e) => e.source_ip)).size,
      blocked_requests: events.filter((e) => (e.status_code ?? 0) >= 400).length,
      anomaly_count: anomalies.length,
      status_codes: statusCodes,
      top_source_ips: Object.entries(ipCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count })),
      traffic_over_time: (() => {
        const bucket: Record<string, number> = {};
        events.forEach((e) => {
          const key = (e.timestamp || "").slice(0, 16) || "unknown";
          bucket[key] = (bucket[key] || 0) + 1;
        });
        return Object.entries(bucket)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([time, count]) => ({ time, count }));
      })(),
      anomalies_by_rule: Object.entries(ruleCount).map(([rule, count]) => ({
        rule,
        count,
      })),
    },
    threat_level: r.threat_level || "low",
  };
}

// Assistant
export async function chatWithAssistant(
  question: string,
  history: ChatMessage[],
  uploadId?: string
): Promise<{ answer: string }> {
  return request<{ answer: string }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ question, history, upload_id: uploadId }),
  });
}

export async function generateNarrative(
  uploadId: string
): Promise<{ report: string }> {
  const data = await request<{ narrative: string }>("/api/assistant/narrative", {
    method: "POST",
    body: JSON.stringify({ upload_id: uploadId }),
  });
  return { report: data.narrative };
}

// Raw backend types
interface RawUpload {
  id?: string;
  filename?: string;
  uploaded_at?: string;
  status?: string;
  total_events?: number;
  flagged_events?: number;
  threat_level?: string;
}

interface RawResult {
  total_events?: number;
  flagged_events?: number;
  threat_level?: string;
  events?: Array<{ timestamp?: string; src_ip?: string; url?: string; status_code?: number }>;
  anomalies?: RawAnomaly[];
}

interface RawAnomaly {
  id?: string;
  type?: string;
  severity?: string;
  description?: string;
  reason?: string;
  affected_ips?: string[];
  confidence?: number;
}

// Types (frontend)
export interface Upload {
  id: string;
  filename: string;
  uploaded_at: string;
  status: string;
  event_count?: number;
  anomaly_count?: number;
  threat_level?: string;
}

export interface LogEvent {
  timestamp: string;
  source_ip: string;
  method?: string;
  url?: string;
  status_code?: number;
  rule?: string;
  severity?: string;
  message?: string;
}

export interface Anomaly {
  id: string;
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  reason?: string;
  affected_ips: string[];
  event_count: number;
  confidence?: number | null;
}

export interface Summary {
  total_events: number;
  unique_ips: number;
  blocked_requests: number;
  anomaly_count: number;
  status_codes: Record<string, number>;
  top_source_ips: { ip: string; count: number }[];
  traffic_over_time: { time: string; count: number }[];
  anomalies_by_rule: { rule: string; count: number }[];
}

export interface UploadDetails {
  events: LogEvent[];
  anomalies: Anomaly[];
  summary: Summary;
  threat_level: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
