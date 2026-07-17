"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

export type Role = "student" | "company" | "mentor" | "admin";

// Roles a visitor may pick at signup. Admins are provisioned server-side via
// `npm run seed:admin`, so the API rejects "admin" here.
export type SelfServiceRole = Exclude<Role, "admin">;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; role: SelfServiceRole }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("excel_connect_token");
    const savedUser = localStorage.getItem("excel_connect_user");
    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  function persist(nextToken: string, nextUser: AuthUser) {
    localStorage.setItem("excel_connect_token", nextToken);
    localStorage.setItem("excel_connect_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  async function login(email: string, password: string) {
    const data = await api<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    persist(data.token, data.user);
  }

  async function register(payload: { name: string; email: string; password: string; role: SelfServiceRole }) {
    const data = await api<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    persist(data.token, data.user);
  }

  function logout() {
    localStorage.removeItem("excel_connect_token");
    localStorage.removeItem("excel_connect_user");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ user, token, login, register, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
