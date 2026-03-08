import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { isAuthenticated, clearToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  authenticated: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  logout: () => {},
  refresh: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const refresh = () => setAuthenticated(isAuthenticated());

  const logout = () => {
    clearToken();
    setAuthenticated(false);
  };

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authenticated) {
      navigate("/login", { replace: true });
    }
  }, [authenticated, navigate]);

  if (!authenticated) return null;
  return <>{children}</>;
}
