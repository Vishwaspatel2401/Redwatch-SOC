import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getUploads, chatWithAssistant, type ChatMessage } from "@/lib/api";
import { Bot, Send, X, MessageSquare, Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MIN_W = 280;
const MAX_W = 640;
const MIN_H = 320;
const MAX_H = 720;
const DEFAULT_W = 320;
const DEFAULT_H = 440;

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [size, setSize] = useState({ width: DEFAULT_W, height: DEFAULT_H });

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeType = useRef<"corner" | "top" | "left">("corner");
  const resizeStart = useRef({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H });

  const { data: uploads } = useQuery({ queryKey: ["uploads"], queryFn: getUploads });
  const activeUploadId = uploads?.[0]?.id;

  const chatMutation = useMutation({
    mutationFn: ({ question, history }: { question: string; history: ChatMessage[] }) =>
      chatWithAssistant(question, history, activeUploadId),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    },
  });

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Global mouse move/up for resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const dx = resizeStart.current.x - e.clientX; // left = grow width
    const dy = resizeStart.current.y - e.clientY; // up   = grow height
    setSize((prev) => {
      const newW =
        resizeType.current === "top"
          ? prev.width
          : Math.min(MAX_W, Math.max(MIN_W, resizeStart.current.width + dx));
      const newH =
        resizeType.current === "left"
          ? prev.height
          : Math.min(MAX_H, Math.max(MIN_H, resizeStart.current.height + dy));
      return { width: newW, height: newH };
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startResize = (e: React.MouseEvent, type: "corner" | "top" | "left") => {
    e.preventDefault();
    isResizing.current = true;
    resizeType.current = type;
    resizeStart.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    document.body.style.cursor =
      type === "corner" ? "nw-resize" : type === "top" ? "n-resize" : "w-resize";
    document.body.style.userSelect = "none";
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate({ question: input, history: newMessages });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat Panel */}
      {isOpen && (
        <div
          className="bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden relative"
          style={{ width: size.width, height: size.height }}
        >
          {/* ── Resize: top-left corner ── */}
          <div
            onMouseDown={(e) => startResize(e, "corner")}
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group"
            title="Drag to resize"
          >
            {/* Visual grip dots */}
            <svg
              width="10" height="10"
              viewBox="0 0 10 10"
              className="absolute top-1 left-1 text-muted-foreground/40 group-hover:text-primary/60 transition-colors"
            >
              <circle cx="2" cy="2" r="1" fill="currentColor" />
              <circle cx="2" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="2" r="1" fill="currentColor" />
            </svg>
          </div>

          {/* ── Resize: top edge ── */}
          <div
            onMouseDown={(e) => startResize(e, "top")}
            className="absolute top-0 left-4 right-0 h-1.5 cursor-n-resize z-10"
          />

          {/* ── Resize: left edge ── */}
          <div
            onMouseDown={(e) => startResize(e, "left")}
            className="absolute top-4 left-0 w-1.5 bottom-0 cursor-w-resize z-10"
          />

          {/* Header */}
          <div className="p-3 border-b border-border bg-primary/5 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center glow-red">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground tracking-widest">A.R.I.A.</p>
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest truncate">
                Automated Response & Intelligence Analyst
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-3"
          >
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask me about threats, anomalies, or IPs from your uploaded logs.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.content}
                  </pre>
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-primary animate-pulse" />
                </div>
                <div className="bg-secondary rounded-lg px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex-shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask A.R.I.A. anything..."
                className="bg-secondary border-border text-xs h-8"
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                disabled={chatMutation.isPending || !input.trim()}
              >
                <Send className="w-3 h-3" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full bg-primary shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all glow-red"
        style={{ width: "52px", height: "52px" }}
        title="Ask A.R.I.A."
      >
        {isOpen ? (
          <X className="w-5 h-5 text-primary-foreground" />
        ) : (
          <MessageSquare className="w-5 h-5 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}
