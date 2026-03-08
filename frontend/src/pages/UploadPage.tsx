import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUploads, uploadLogFile, type Upload } from "@/lib/api";
import { Upload as UploadIcon, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["uploads"],
    queryFn: getUploads,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadLogFile,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      toast.success("Log file uploaded successfully");
      navigate(`/app/dashboard?upload=${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Upload failed");
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const threatColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case "critical": return "text-threat-critical";
      case "high": return "text-threat-high";
      case "medium": return "text-threat-medium";
      case "low": return "text-threat-low";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload Apache, ZScaler, or JSON log files for analysis
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".log,.txt,.json,.ndjson,.csv,.gz"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadIcon className={`w-10 h-10 mx-auto mb-4 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-foreground font-medium">
          {uploadMutation.isPending
            ? "Uploading..."
            : "Drop log files here or click to browse"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Supports .log, .txt, .json, .ndjson, .csv, .gz files
        </p>
      </div>

      {/* Upload History */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Upload History</h2>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading uploads...</div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No uploads yet. Upload your first log file above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/app/dashboard?upload=${upload.id}`)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">
                      {upload.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(upload.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {upload.event_count !== undefined && (
                    <span className="text-muted-foreground font-mono">
                      {upload.event_count} events
                    </span>
                  )}
                  {upload.threat_level && (
                    <span className={`font-mono font-semibold uppercase text-xs ${threatColor(upload.threat_level)}`}>
                      {upload.threat_level}
                    </span>
                  )}
                  <StatusBadge status={upload.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex items-center gap-1 text-xs text-threat-low">
          <CheckCircle2 className="w-3.5 h-3.5" /> Done
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-threat-medium">
          <Clock className="w-3.5 h-3.5 animate-spin" /> Processing
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-xs text-threat-critical">
          <XCircle className="w-3.5 h-3.5" /> Failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> {status}
        </span>
      );
  }
}
