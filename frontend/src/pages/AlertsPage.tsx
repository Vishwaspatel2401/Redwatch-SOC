import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getUploadDetails, getUploads, type Anomaly } from "@/lib/api";
import { AlertTriangle, ChevronRight, Globe, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AlertsPage() {
  const [searchParams] = useSearchParams();
  const uploadId = searchParams.get("upload");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  const { data: uploads } = useQuery({ queryKey: ["uploads"], queryFn: getUploads });
  const activeUploadId = uploadId || uploads?.[0]?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["upload-details", activeUploadId],
    queryFn: () => getUploadDetails(activeUploadId!),
    enabled: !!activeUploadId,
  });

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const anomalies = (data?.anomalies || []).sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  const severityColor: Record<string, string> = {
    critical: "border-l-threat-critical bg-threat-critical/5",
    high: "border-l-threat-high bg-threat-high/5",
    medium: "border-l-threat-medium bg-threat-medium/5",
    low: "border-l-threat-low bg-threat-low/5",
  };

  const severityBadge: Record<string, string> = {
    critical: "bg-threat-critical/15 text-threat-critical",
    high: "bg-threat-high/15 text-threat-high",
    medium: "bg-threat-medium/15 text-threat-medium",
    low: "bg-threat-low/15 text-threat-low",
  };

  if (!activeUploadId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No data. Upload a log file first.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Security Alerts</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : anomalies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No anomalies detected</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* List */}
          <div className={`space-y-2 ${selectedAnomaly ? "w-1/2" : "w-full"} transition-all`}>
            {anomalies.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedAnomaly(a)}
                className={`border-l-4 border rounded-r-lg p-4 cursor-pointer transition-colors hover:bg-accent/30 ${
                  severityColor[a.severity]
                } ${selectedAnomaly?.id === a.id ? "ring-1 ring-primary/30" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${severityBadge[a.severity]}`}>
                      {a.severity}
                    </span>
                    <span className="text-sm font-medium text-foreground">{a.rule}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedAnomaly && (
            <div className="w-1/2 bg-card border border-border rounded-lg p-6 sticky top-8 self-start">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-1 rounded text-xs font-mono uppercase font-semibold ${severityBadge[selectedAnomaly.severity]}`}>
                  {selectedAnomaly.severity}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setSelectedAnomaly(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">{selectedAnomaly.rule}</h3>
              <p className="text-sm text-muted-foreground mb-6">{selectedAnomaly.description}</p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Affected IPs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnomaly.affected_ips.map((ip) => (
                      <span key={ip} className="bg-secondary px-2.5 py-1 rounded text-xs font-mono text-foreground">
                        {ip}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Event Count
                  </h4>
                  <p className="text-2xl font-bold font-mono text-foreground">
                    {selectedAnomaly.event_count}
                  </p>
                </div>

                {selectedAnomaly.confidence != null && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Confidence</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(selectedAnomaly.confidence * 100)}%`,
                            background: selectedAnomaly.confidence >= 0.85
                              ? "hsl(0, 72%, 51%)"
                              : selectedAnomaly.confidence >= 0.7
                              ? "hsl(25, 95%, 53%)"
                              : "hsl(45, 93%, 47%)",
                          }}
                        />
                      </div>
                      <span className="text-sm font-mono font-bold text-foreground w-10 text-right">
                        {Math.round(selectedAnomaly.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {selectedAnomaly.reason && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Why It's Suspicious</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedAnomaly.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
