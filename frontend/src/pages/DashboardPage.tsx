import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getUploadDetails, getUploads, type LogEvent, type Upload } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Globe, ShieldAlert, AlertTriangle, Wifi, Search, TrendingUp,
  History, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList,
} from "recharts";

// ─── Reference data ──────────────────────────────────────────────────────────

const STATUS_MEANINGS: Record<string, string> = {
  "200": "OK – request succeeded",
  "201": "Created – resource created",
  "204": "No Content – success",
  "301": "Moved Permanently",
  "302": "Temporary Redirect",
  "304": "Not Modified – cached",
  "400": "Bad Request – invalid syntax",
  "401": "Unauthorized – login required",
  "403": "Forbidden – access denied",
  "404": "Not Found – missing resource",
  "429": "Too Many Requests – rate limited",
  "500": "Internal Server Error",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
};

const RULE_DESCRIPTIONS: Record<string, string> = {
  brute_force: "Multiple failed logins from one IP",
  data_exfil: "Unusually large data transfer",
  sql_injection: "SQL injection pattern detected",
  after_hours_access: "Access outside business hours",
  port_scan: "Sequential port scanning",
  ddos: "High-volume flood attack",
};

const RULE_COLORS = [
  "hsl(0, 72%, 51%)",
  "hsl(280, 65%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(25, 95%, 53%)",
  "hsl(142, 71%, 45%)",
];

// Each status code gets its OWN distinct color regardless of category
const STATUS_PALETTE = [
  "hsl(142, 71%, 45%)",   // green
  "hsl(162, 65%, 42%)",   // teal
  "hsl(185, 80%, 44%)",   // cyan
  "hsl(25, 95%, 53%)",    // orange
  "hsl(0, 72%, 51%)",     // red
  "hsl(45, 93%, 47%)",    // yellow
  "hsl(280, 65%, 60%)",   // purple
  "hsl(199, 89%, 48%)",   // blue
];

// ─── Pie slice % label (pointerEvents none so hover still hits the arc) ───────

function renderSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if ((percent || 0) < 0.03) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * R);
  const y = cy + r * Math.sin(-midAngle * R);
  return (
    <text
      x={x} y={y}
      fill="rgba(255,255,255,0.95)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
      pointerEvents="none"
    >
      {`${((percent || 0) * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function getIpBarColor(count: number, max: number): string {
  const r = max > 0 ? count / max : 0;
  if (r > 0.7) return "hsl(0, 72%, 51%)";     // red – dominant / suspicious
  if (r > 0.4) return "hsl(25, 95%, 53%)";    // orange – high
  if (r > 0.15) return "hsl(45, 93%, 47%)";   // yellow – medium
  return "hsl(199, 89%, 48%)";                 // blue – normal
}

function formatTimeLabel(tick: string): string {
  if (!tick || tick === "unknown") return tick;
  const t = tick.split("T")[1];
  return t ? t.slice(0, 5) : tick.slice(11, 16);
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

const TT = { background: "#13161f", border: "1px solid #2a2f3d", borderRadius: 8, padding: "10px 14px" } as const;

function TrafficTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>{payload[0].value} requests</p>
      <p style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>in this minute</p>
    </div>
  );
}


function IpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Source IP Address</p>
      <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{label}</p>
      <p style={{ color: "#e2e8f0", fontSize: 14, marginTop: 6 }}>
        <span style={{ fontWeight: 700 }}>{payload[0].value}</span>
        <span style={{ color: "#64748b", fontSize: 11 }}> total requests</span>
      </p>
    </div>
  );
}

function RuleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const desc = RULE_DESCRIPTIONS[label] || label;
  const displayName = label?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  return (
    <div style={{ ...TT, maxWidth: 220 }}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Detection Rule</p>
      <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{displayName}</p>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{desc}</p>
      <p style={{ color: "#e2e8f0", fontSize: 14, marginTop: 8 }}>
        <span style={{ fontWeight: 700 }}>{payload[0].value}</span>
        <span style={{ color: "#64748b", fontSize: 11 }}> anomalies triggered</span>
      </p>
    </div>
  );
}


// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uploadId = searchParams.get("upload");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: uploads } = useQuery({
    queryKey: ["uploads"],
    queryFn: getUploads,
  });

  const activeUploadId = uploadId || uploads?.[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["upload-details", activeUploadId],
    queryFn: () => getUploadDetails(activeUploadId!),
    enabled: !!activeUploadId,
  });

  if (!activeUploadId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No log data available. Upload a log file to get started.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="font-mono text-sm">Analyzing log data...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Computed insights ──
  const statusData = Object.entries(data.summary.status_codes)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => Number(a.name) - Number(b.name));
  const totalRequests = statusData.reduce((a, b) => a + b.value, 0);
  const errorCount = statusData.filter(s => Number(s.name) >= 400).reduce((a, b) => a + b.value, 0);
  const errorPct = totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(0) : "0";

  const maxIpCount = Math.max(...(data.summary.top_source_ips?.map(ip => ip.count) ?? [1]), 1);
  const topIp = data.summary.top_source_ips?.[0];

  const topRule = data.summary.anomalies_by_rule?.[0];
  const totalAnomalies = data.summary.anomalies_by_rule?.reduce((a, b) => a + b.count, 0) ?? 0;

  const trafficPeak = data.summary.traffic_over_time?.reduce(
    (best, cur) => cur.count > best.count ? cur : best,
    { time: "", count: 0 }
  );

  const currentUpload = uploads?.find(u => u.id === activeUploadId);

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Threat Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            {currentUpload ? (
              <>
                <span className="font-mono text-foreground/80">{currentUpload.filename}</span>
                <span className="text-border">·</span>
                <span>{currentUpload.event_count ?? data.summary.total_events} events</span>
                <span className="text-border">·</span>
                <span>uploaded {new Date(currentUpload.uploaded_at).toLocaleString()}</span>
              </>
            ) : "Upload a log file to begin analysis"}
          </p>
        </div>
        {/* Generate Report button for current analysis */}
        <button
          onClick={() => navigate("/app/reports")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-sm font-medium flex-shrink-0"
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {/* ── Past Analyses History Panel ── */}
      {uploads && uploads.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setHistoryOpen(h => !h)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="w-4 h-4 text-muted-foreground" />
              Past Analyses
              <span className="text-xs font-normal text-muted-foreground ml-1">({uploads.length} upload{uploads.length !== 1 ? "s" : ""})</span>
            </div>
            {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {historyOpen && (
            <div className="border-t border-border divide-y divide-border/50">
              {uploads.map((upload) => {
                const isActive = upload.id === activeUploadId;
                return (
                  <div
                    key={upload.id}
                    onClick={() => !isActive && navigate(`/app/dashboard?upload=${upload.id}`)}
                    className={`flex items-center justify-between px-5 py-3 gap-4 transition-colors ${isActive ? "bg-primary/5" : "hover:bg-accent/20 cursor-pointer"}`}
                  >
                    {/* File info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                          {upload.filename}
                          {isActive && <span className="ml-2 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono">ACTIVE</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(upload.uploaded_at).toLocaleString()}
                          {upload.event_count != null && <span className="ml-2">· {upload.event_count} events</span>}
                        </p>
                      </div>
                    </div>

                    {/* Right side: threat badge + Ask AI */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {upload.threat_level && (
                        <HistoryThreatBadge level={upload.threat_level} />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate("/app/reports"); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                      >
                        <FileText className="w-3 h-3" />
                        Report
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard icon={Activity} label="Total Events" value={data.summary.total_events} sub="log entries found" />
        <MetricCard icon={Globe} label="Unique IPs" value={data.summary.unique_ips} sub="distinct source addresses" />
        <MetricCard icon={ShieldAlert} label="Blocked" value={data.summary.blocked_requests} color="text-threat-high" sub="requests denied" />
        <MetricCard icon={AlertTriangle} label="Anomalies" value={data.summary.anomaly_count} color="text-threat-medium" sub="suspicious events" />
        <ThreatLevelCard level={data.threat_level} />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Traffic Over Time */}
        <ChartCard
          title="Traffic Over Time"
          subtitle="Requests per minute — sudden spikes often indicate automated attacks or scans"
          insight={trafficPeak?.count > 0
            ? `Peak: ${trafficPeak.count} requests at ${formatTimeLabel(trafficPeak.time)}`
            : undefined}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.summary.traffic_over_time} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTimeLabel}
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                allowDecimals={false}
                label={{ value: "Reqs", angle: -90, position: "insideLeft", fill: "hsl(215,15%,40%)", fontSize: 10, dx: 12 }}
              />
              <RTooltip content={<TrafficTooltip />} cursor={{ stroke: "hsl(220,14%,30%)", strokeWidth: 1, fill: "rgba(255,255,255,0.02)" }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(0, 72%, 51%)"
                fill="url(#trafficGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(0, 72%, 51%)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* HTTP Status Codes */}
        <ChartCard
          title="HTTP Status Codes"
          subtitle="How the server responded — hover a slice to inspect it"
          insight={Number(errorPct) > 0
            ? `${errorPct}% of requests were errors (4xx/5xx) — possible attack traffic`
            : "All requests responded successfully"}
        >
          <StatusCodesChart statusData={statusData} totalRequests={totalRequests} />
        </ChartCard>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Source IPs */}
        <ChartCard
          title="Top Source IPs"
          subtitle="IPs with the most requests — red bars are dominant sources (possible attackers)"
          insight={topIp
            ? `Most active: ${topIp.ip} made ${topIp.count} requests — ${getIpBarColor(topIp.count, maxIpCount) === "hsl(0, 72%, 51%)" ? "⚠ flagged as suspicious" : "normal activity"}`
            : undefined}
        >
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data.summary.top_source_ips} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} allowDecimals={false} />
              <YAxis
                type="category" dataKey="ip"
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10, fontFamily: "monospace" }}
                width={112}
              />
              <RTooltip content={<IpTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.summary.top_source_ips?.map((entry, i) => (
                  <Cell key={i} fill={getIpBarColor(entry.count, maxIpCount)} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Color key */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 px-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "hsl(0,72%,51%)" }} />High — possible attacker</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "hsl(25,95%,53%)" }} />Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "hsl(199,89%,48%)" }} />Normal</span>
          </div>
        </ChartCard>

        {/* Anomalies by Rule */}
        <ChartCard
          title="Anomalies by Rule"
          subtitle="Security rules that fired — each bar is a type of attack or suspicious behaviour detected"
          insight={topRule
            ? `Most common: "${topRule.rule.replace(/_/g, " ")}" (${topRule.count} of ${totalAnomalies} anomalies)`
            : undefined}
        >
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data.summary.anomalies_by_rule} margin={{ top: 22, right: 8, bottom: 44, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
              <XAxis
                dataKey="rule"
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                tickFormatter={(r) => r.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                angle={-18}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} allowDecimals={false} />
              <RTooltip content={<RuleTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.summary.anomalies_by_rule?.map((_, i) => (
                  <Cell key={i} fill={RULE_COLORS[i % RULE_COLORS.length]} />
                ))}
                <LabelList dataKey="count" position="top" style={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Rule descriptions */}
          <div className="mt-1 space-y-1 px-1">
            {data.summary.anomalies_by_rule?.slice(0, 3).map((item, i) => (
              <div key={item.rule} className="flex items-center gap-2 text-[10px]">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: RULE_COLORS[i % RULE_COLORS.length] }} />
                <span className="font-mono text-foreground/80 flex-shrink-0">{item.rule.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">— {RULE_DESCRIPTIONS[item.rule] || ""}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── Log Events Table ── */}
      <LogEventsTable events={data.events} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusCodesChart({ statusData, totalRequests }: {
  statusData: { name: string; value: number }[];
  totalRequests: number;
}) {
  const [active, setActive] = useState<{ name: string; value: number; pct: number; color: string } | null>(null);

  return (
    <>
      <div className="relative">
        <ResponsiveContainer width="100%" height={185}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%" cy="50%"
              outerRadius={78} innerRadius={46}
              dataKey="value" nameKey="name"
              paddingAngle={0} stroke="none"
              labelLine={false}
              label={renderSliceLabel}
              onMouseEnter={(data, index) => setActive({
                name: data.name,
                value: data.value,
                pct: data.percent ?? (totalRequests > 0 ? data.value / totalRequests : 0),
                color: STATUS_PALETTE[index % STATUS_PALETTE.length],
              })}
              onMouseLeave={() => setActive(null)}
            >
              {statusData.map((_, i) => (
                <Cell key={i} fill={STATUS_PALETTE[i % STATUS_PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — shows total by default, slice info on hover */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: 10 }}>
          <div className="text-center transition-all duration-150">
            {active ? (
              <>
                <div className="text-lg font-bold font-mono" style={{ color: active.color }}>
                  {active.value}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: active.color }}>
                  HTTP {active.name}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {(active.pct * 100).toFixed(1)}%
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold font-mono text-foreground">{totalRequests}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Total</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-1.5 px-1">
        {statusData.map((entry, i) => {
          const pct = totalRequests > 0 ? ((entry.value / totalRequests) * 100).toFixed(1) : "0";
          const meaning = STATUS_MEANINGS[entry.name] || entry.name;
          const color = STATUS_PALETTE[i % STATUS_PALETTE.length];
          const isActive = active?.name === entry.name;
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between text-xs gap-2 rounded px-1 transition-colors"
              style={{ background: isActive ? `${color}15` : "transparent" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                <span className="font-mono font-bold text-foreground flex-shrink-0">{entry.name}</span>
                <span className="text-muted-foreground truncate text-[11px]">{meaning}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-muted-foreground font-mono text-[11px]">{entry.value}</span>
                <span className="font-mono font-bold text-[11px] w-9 text-right" style={{ color }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number; color?: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${color || "text-foreground"}`}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ThreatLevelCard({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    critical: "text-threat-critical bg-threat-critical/10 border-threat-critical/30",
    high: "text-threat-high bg-threat-high/10 border-threat-high/30",
    medium: "text-threat-medium bg-threat-medium/10 border-threat-medium/30",
    low: "text-threat-low bg-threat-low/10 border-threat-low/30",
  };
  const classes = colorMap[level.toLowerCase()] || "text-muted-foreground bg-card border-border";
  return (
    <div className={`rounded-lg p-4 border ${classes}`}>
      <div className="flex items-center gap-2 mb-2">
        <Wifi className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider opacity-80">Threat Level</span>
      </div>
      <p className="text-2xl font-bold font-mono uppercase">{level}</p>
      <p className="text-[10px] mt-1 opacity-70">overall risk score</p>
    </div>
  );
}

function ChartCard({ title, subtitle, insight, children }: {
  title: string; subtitle?: string; insight?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
      {insight && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <TrendingUp size={10} className="text-threat-medium flex-shrink-0" />
            {insight}
          </p>
        </div>
      )}
    </div>
  );
}

function LogEventsTable({ events }: { events: LogEvent[] }) {
  const [search, setSearch] = useState("");
  const [ruleFilter, setRuleFilter] = useState("all");

  const rules = useMemo(() => {
    const set = new Set(events.map((e) => e.rule).filter(Boolean));
    return Array.from(set) as string[];
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (ruleFilter !== "all" && e.rule !== ruleFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.source_ip?.toLowerCase().includes(s) ||
          e.url?.toLowerCase().includes(s) ||
          e.message?.toLowerCase().includes(s) ||
          e.rule?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [events, search, ruleFilter]);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            Log Events ({filtered.length})
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Every request recorded in your uploaded log file</p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border-border max-w-xs h-8 text-sm"
          />
          <Select value={ruleFilter} onValueChange={setRuleFilter}>
            <SelectTrigger className="bg-secondary border-border w-40 h-8 text-sm">
              <SelectValue placeholder="Filter by rule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules</SelectItem>
              {rules.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3">Timestamp</th>
              <th className="p-3">Source IP</th>
              <th className="p-3">Method</th>
              <th className="p-3">URL</th>
              <th className="p-3">Status</th>
              <th className="p-3">Rule</th>
              <th className="p-3">Severity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((event, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{event.timestamp}</td>
                <td className="p-3 font-mono text-xs text-foreground">{event.source_ip}</td>
                <td className="p-3 font-mono text-xs text-foreground">{event.method || "—"}</td>
                <td className="p-3 font-mono text-xs text-foreground max-w-xs truncate">{event.url || "—"}</td>
                <td className="p-3 font-mono text-xs">
                  <StatusCode code={event.status_code} />
                </td>
                <td className="p-3 text-xs text-muted-foreground">{event.rule || "—"}</td>
                <td className="p-3">
                  <SeverityBadge severity={event.severity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No matching events</div>
        )}
      </div>
    </div>
  );
}

function StatusCode({ code }: { code?: number }) {
  if (!code) return <span className="text-muted-foreground">—</span>;
  const color = code >= 500 ? "text-threat-critical" : code >= 400 ? "text-threat-high" : code >= 300 ? "text-threat-medium" : "text-threat-low";
  return <span className={color}>{code}</span>;
}

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return <span className="text-muted-foreground text-xs">—</span>;
  const colorMap: Record<string, string> = {
    critical: "bg-threat-critical/15 text-threat-critical",
    high: "bg-threat-high/15 text-threat-high",
    medium: "bg-threat-medium/15 text-threat-medium",
    low: "bg-threat-low/15 text-threat-low",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${colorMap[severity.toLowerCase()] || "text-muted-foreground"}`}>
      {severity}
    </span>
  );
}

function HistoryThreatBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    critical: "bg-threat-critical/15 text-threat-critical border-threat-critical/30",
    high:     "bg-threat-high/15 text-threat-high border-threat-high/30",
    medium:   "bg-threat-medium/15 text-threat-medium border-threat-medium/30",
    low:      "bg-threat-low/15 text-threat-low border-threat-low/30",
  };
  const classes = colorMap[level.toLowerCase()] || "bg-muted/30 text-muted-foreground border-border";
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase font-semibold tracking-wide ${classes}`}>
      {level}
    </span>
  );
}
