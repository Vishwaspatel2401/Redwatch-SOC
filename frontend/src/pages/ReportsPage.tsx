import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getUploadDetails, getUploads, generateNarrative } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, Loader2, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function ReportsPage() {
  const [report, setReport] = useState<string | null>(null);

  const { data: uploads } = useQuery({ queryKey: ["uploads"], queryFn: getUploads });
  const activeUploadId = uploads?.[0]?.id;

  const { data } = useQuery({
    queryKey: ["upload-details", activeUploadId],
    queryFn: () => getUploadDetails(activeUploadId!),
    enabled: !!activeUploadId,
  });

  const narrativeMutation = useMutation({
    mutationFn: () => generateNarrative(activeUploadId!),
    onSuccess: (res) => {
      setReport(res.report);
      toast.success("Incident report generated");
    },
    onError: () => toast.error("Failed to generate report"),
  });

  const handleExportPDF = () => {
    if (!report) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    // Red header bar
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, pageWidth, 22, "F");

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("RedWatch SOC — Incident Report", margin, 14);

    // Date on right
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 14, { align: "right" });

    // Divider line
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(margin, 26, pageWidth - margin, 26);

    // Body text
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(report, maxWidth);
    let y = 32;
    const lineHeight = 5;

    lines.forEach((line: string) => {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });

    // Footer on each page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `RedWatch SOC Platform — Confidential — Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    doc.save(`redwatch-incident-report-${Date.now()}.pdf`);
    toast.success("Report downloaded as PDF");
  };

  const anomalies = data?.anomalies ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" />
          Incident Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate AI-powered incident reports from your uploaded log analysis.
        </p>
      </div>

      {/* Anomaly Summary Card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-threat-high" />
          Detected Anomalies
        </h2>

        {!activeUploadId ? (
          <p className="text-sm text-muted-foreground py-2">
            No log file uploaded yet. Go to Upload to analyse a log file first.
          </p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No anomalies detected in the current log.</p>
        ) : (
          <div className="space-y-1 mb-5">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-threat-high flex-shrink-0" />
                  <span className="text-foreground font-mono text-xs">{anomaly.rule}</span>
                  {anomaly.description && (
                    <span className="text-muted-foreground text-xs hidden sm:inline truncate max-w-xs">
                      — {anomaly.description}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0 ml-2 ${
                    anomaly.severity === "critical" || anomaly.severity === "high"
                      ? "bg-red-500/10 text-red-400"
                      : anomaly.severity === "medium"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {anomaly.severity}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={() => narrativeMutation.mutate()}
          disabled={narrativeMutation.isPending || !activeUploadId}
          className="w-full"
        >
          {narrativeMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Generate Incident Report
            </>
          )}
        </Button>
      </div>

      {/* Generated Report */}
      {report && (
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Incident Report
            </h3>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="w-3.5 h-3.5 mr-2" />
              Export PDF
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground leading-relaxed bg-secondary/50 p-4 rounded-md overflow-auto">
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}
