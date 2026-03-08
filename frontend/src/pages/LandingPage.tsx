import { Link } from "react-router-dom";
import {
  Shield, Upload, BarChart2, Bell, MessageSquare,
  ChevronRight, Globe, Zap, Lock, Eye, AlertTriangle, FileSearch
} from "lucide-react";

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
        {/* Glow blob */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Zap className="h-3 w-3" />
            AI-Powered SOC Log Analysis
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
            Detect Threats.<br />
            <span className="text-primary">Before They Strike.</span>
          </h1>

          <p className="mb-10 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            RedWatch analyses your network logs in seconds — detecting intrusions,
            anomalies, and suspicious activity with AI-driven intelligence built
            for security teams.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:shadow-primary/40"
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

        {/* Floating stats */}
        <div className="relative z-10 mt-20 grid grid-cols-3 gap-6 max-w-2xl mx-auto w-full">
          {[
            { value: "< 5s", label: "Log Analysis Time" },
            { value: "3+", label: "Log Formats Supported" },
            { value: "AI", label: "Threat Intelligence" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/60 backdrop-blur p-5 text-center">
              <p className="text-2xl font-bold text-primary font-mono">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">Everything a SOC Team Needs</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From log ingestion to AI-driven investigation — RedWatch covers the full
            incident detection and response workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Upload,
              title: "Multi-Format Upload",
              desc: "Drop in Apache, ZScaler, or JSON logs. RedWatch parses and normalises them instantly, no configuration needed.",
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              icon: BarChart2,
              title: "Live Threat Dashboard",
              desc: "Real-time charts showing traffic patterns, HTTP status breakdowns, top source IPs, and anomaly distribution at a glance.",
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: Bell,
              title: "Smart Alerting",
              desc: "Automatic detection of ip_burst, phishing_attempt, data_exfil, malware_contact, and more — with severity scoring.",
              color: "text-orange-400",
              bg: "bg-orange-400/10",
            },
            {
              icon: MessageSquare,
              title: "AI Security Analyst",
              desc: "Ask questions about your logs in plain English. The AI assistant explains threats, identifies suspicious IPs, and recommends actions.",
              color: "text-green-400",
              bg: "bg-green-400/10",
            },
            {
              icon: FileSearch,
              title: "Incident Narratives",
              desc: "Generate professional incident reports with one click — ready to share with your security team or management.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: Lock,
              title: "Secure by Design",
              desc: "JWT authentication, per-user data isolation, and no log data shared externally. Your incidents stay private.",
              color: "text-yellow-400",
              bg: "bg-yellow-400/10",
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors group">
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
      <section className="px-6 py-24 bg-card/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground">Three steps from raw log to actionable intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />

            {[
              { step: "01", icon: Upload,      title: "Upload Logs",       desc: "Drag and drop your log files — Apache, ZScaler, or JSON. Supports files of any size." },
              { step: "02", icon: Eye,         title: "AI Analyses",       desc: "The backend parses events, runs anomaly detection, and generates a threat level assessment." },
              { step: "03", icon: AlertTriangle, title: "Investigate",     desc: "Explore the dashboard, review alerts, and chat with the AI analyst to drill into incidents." },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="mb-5 relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {step}
                  </span>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported Formats ───────────────────────────────── */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-foreground mb-3">Supports Your Log Formats</h2>
        <p className="text-muted-foreground mb-10 text-sm">No pre-processing or conversion required.</p>
        <div className="flex flex-wrap justify-center gap-4">
          {["Apache / Nginx", "ZScaler NSS", "JSON Structured", "CSV", "Plain Text .log"].map((fmt) => (
            <div key={fmt} className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground">
              <Globe className="h-3.5 w-3.5 text-primary" />
              {fmt}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto rounded-2xl border border-primary/30 bg-primary/5 p-12 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
          </div>
          <div className="relative z-10">
            <Shield className="h-10 w-10 text-primary mx-auto mb-5" />
            <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Secure Your Network?</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your first log file and get an AI-generated threat assessment in under a minute.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
            >
              Get Started Free
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border px-8 py-8 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold tracking-widest uppercase text-foreground">RedWatch</span>
          <span className="ml-2">SOC Log Analysis Platform</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
        </div>
      </footer>

    </div>
  );
}
