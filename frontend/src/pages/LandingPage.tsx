import { Link } from "react-router-dom";
import { Shield, Upload, BarChart2, MessageSquare, ChevronRight, Zap, Eye, AlertTriangle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-widest uppercase text-foreground">RedWatch</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link to="/register" className="text-sm font-semibold bg-primary text-white px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center grid-bg">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Zap className="h-3 w-3" />
            AI-Powered SOC Log Analysis
          </div>

          <h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
            Detect Threats.<br />
            <span className="text-primary">Before They Strike.</span>
          </h1>

          <p className="mb-10 text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Upload your network logs and get an AI-powered threat assessment — anomalies, affected IPs, and a full incident report in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all"
            >
              Start Analysing Logs
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-colors"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-3">What RedWatch Does</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Upload a log file and let the platform handle detection, visualisation, and reporting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: Upload,
              title: "Upload & Parse",
              desc: "Supports Apache, ZScaler, and JSON log formats. Drop a file and it's parsed instantly.",
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              icon: BarChart2,
              title: "Threat Dashboard",
              desc: "Charts showing traffic patterns, top source IPs, HTTP status codes, and detected anomalies.",
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: MessageSquare,
              title: "AI Assistant & Reports",
              desc: "Ask questions about your logs in plain English, or generate a full incident report with one click.",
              color: "text-green-400",
              bg: "bg-green-400/10",
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="px-6 py-20 bg-card/30 border-y border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-sm text-muted-foreground">Three steps from raw log to actionable intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: Upload,        title: "Upload",     desc: "Drop your log file — Apache, ZScaler, or JSON." },
              { step: "02", icon: Eye,           title: "Analyse",    desc: "AI parses events and generates a threat assessment." },
              { step: "03", icon: AlertTriangle, title: "Investigate",desc: "Review alerts, explore charts, and export a report." },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="mb-4 relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {step}
                  </span>
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border px-8 py-6 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold tracking-widest uppercase text-foreground">RedWatch</span>
          <span className="ml-2">SOC Platform</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
        </div>
      </footer>

    </div>
  );
}
