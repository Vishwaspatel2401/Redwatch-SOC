import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getUploadDetails, getUploads, chatWithAssistant, generateNarrative,
  type ChatMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, Send, FileText, AlertTriangle, Loader2, User,
} from "lucide-react";
import { toast } from "sonner";

export default function AssistantPage() {
  const [searchParams] = useSearchParams();
  const uploadId = searchParams.get("upload");

  const { data: uploads } = useQuery({ queryKey: ["uploads"], queryFn: getUploads });
  const activeUploadId = uploadId || uploads?.[0]?.id;

  const { data } = useQuery({
    queryKey: ["upload-details", activeUploadId],
    queryFn: () => getUploadDetails(activeUploadId!),
    enabled: !!activeUploadId,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: ({ question, history }: { question: string; history: ChatMessage[] }) =>
      chatWithAssistant(question, history),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    },
    onError: () => toast.error("Failed to get response"),
  });

  const narrativeMutation = useMutation({
    mutationFn: () => generateNarrative(activeUploadId!),
    onSuccess: (res) => setReport(res.report),
    onError: () => toast.error("Failed to generate report"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate({ question: input, history: newMessages });
  };

  const triggeredRules = data?.anomalies
    ? [...new Set(data.anomalies.map((a) => a.rule))]
    : [];

  return (
    <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* Left: Incident Summary */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="bg-card border border-border rounded-lg p-5 flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-threat-high" />
            Incident Summary
          </h2>

          {triggeredRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-2 mb-4">
              {triggeredRules.map((rule) => (
                <div key={rule} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-threat-high" />
                  <span className="text-foreground font-mono text-xs">{rule}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => narrativeMutation.mutate()}
            disabled={narrativeMutation.isPending || !activeUploadId}
            className="w-full"
            size="sm"
          >
            {narrativeMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 mr-2" />
                Generate Incident Report
              </>
            )}
          </Button>
        </div>

        {/* Report */}
        {report && (
          <div className="bg-card border border-border rounded-lg p-5 flex-1 overflow-auto">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Incident Report
            </h3>
            <div className="prose prose-sm prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground leading-relaxed bg-secondary/50 p-4 rounded-md">
                {report}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Right: Chat */}
      <div className="lg:col-span-3 bg-card border border-border rounded-lg flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI Analyst</h2>
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
            Powered by AI
          </span>
        </div>

        {/* Messages */}
        <div
          className="overflow-y-auto p-4 space-y-4 transition-all duration-300"
          style={{ minHeight: messages.length === 0 ? "160px" : "240px", maxHeight: "560px" }}
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                Ask me about the uploaded logs, anomalies, or threats.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {msg.content}
                </pre>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about threats, anomalies, IPs..."
              className="bg-secondary border-border"
              disabled={chatMutation.isPending}
            />
            <Button type="submit" size="icon" disabled={chatMutation.isPending || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
