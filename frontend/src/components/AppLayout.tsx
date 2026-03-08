import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Gauge,
  HardDriveUpload,
  Siren,
  FileText,
  LogOut,
  Shield,
} from "lucide-react";
import ChatBubble from "@/components/ChatBubble";

const navItems = [
  { to: "/app/dashboard", icon: Gauge,           label: "Dashboard" },
  { to: "/app/upload",    icon: HardDriveUpload,  label: "Upload"    },
  { to: "/app/alerts",    icon: Siren,            label: "Alerts"    },
  { to: "/app/reports",   icon: FileText,         label: "Reports"   },
];

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link
            to="/app/dashboard"
            className="flex items-center gap-3 rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-red">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                RedWatch
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                SOC Platform
              </p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />
        <ChatBubble />
      </main>
    </div>
  );
}
