"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { ThemeName, isThemeName, useTheme } from "@/components/ThemeProvider";

export type Role = "student" | "company" | "mentor" | "admin";

// Roles a visitor may pick at signup. Admins are provisioned server-side via
// `npm run seed:admin`, so the API rejects "admin" here.
export type SelfServiceRole = Exclude<Role, "admin">;

export type StudentProfile = {
  university?: string;
  program?: string;
  graduationYear?: number;
  location?: string;
  skills?: string[];
  cvUrl?: string;
  bio?: string;
};

export type CompanyProfile = {
  companyName?: string;
  industry?: string;
  website?: string;
  location?: string;
  description?: string;
};

export type MentorProfile = {
  expertise?: string;
  organization?: string;
  yearsExperience?: number;
  website?: string;
  location?: string;
  topics?: string[];
  bio?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: "active" | "suspended";
  emailVerified?: boolean;
  phone?: string | null;
  preferences?: { theme?: ThemeName };
  studentProfile?: StudentProfile;
  companyProfile?: CompanyProfile;
  mentorProfile?: MentorProfile;
};

/**
 * loading         - a stored session is being verified against the API
 * authenticated   - the API confirmed this token belongs to an active account
 * unauthenticated - no session, or the stored one was rejected
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  /** True once the session has been checked, whatever the outcome. */
  isReady: boolean;
  /** Authenticated, but the role-specific profile has not been filled in yet. */
  needsProfile: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  applyUser: (user: AuthUser) => void;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: SelfServiceRole;
};

const TOKEN_KEY = "excel_connect_token";
const USER_KEY = "excel_connect_user";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(key: string) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function clearStored() {
  try {
    [localStorage, sessionStorage].forEach((store) => {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
    });
  } catch {
    // Storage unavailable; in-memory state is cleared by the caller regardless.
  }
}

/** Has this account filled in the profile its role actually uses? */
function computeNeedsProfile(user: AuthUser | null) {
  if (!user) return false;
  if (user.role === "company") return !user.companyProfile?.companyName;
  if (user.role === "mentor") return !user.mentorProfile?.expertise;
  if (user.role === "student") return !user.studentProfile?.university;
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const queryClient = useQueryClient();

  const persist = useCallback((nextToken: string, nextUser: AuthUser, remember = true) => {
    try {
      const storage = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      other.removeItem(TOKEN_KEY);
      other.removeItem(USER_KEY);
      storage.setItem(TOKEN_KEY, nextToken);
      storage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // Session still works for this tab even if it cannot be cached.
    }
    setToken(nextToken);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    clearStored();
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    // Without this the next account to sign in on this device would briefly see
    // the previous user's cached opportunities, applications, and admin lists.
    queryClient.clear();
  }, [queryClient]);

  /* -------------------------------------------------------------------------
     Session bootstrap.
     -------------------------------------------------------------------------
     The stored token is a convenience cache, never the authority. On every load
     it is presented to /auth/me, and the account the API returns is what the UI
     trusts. A token that was edited by hand, has expired, or belongs to an
     account that has since been suspended is rejected there and the session is
     discarded. Route guards built on this state are for the user's benefit; the
     API enforces access on every single request regardless of what the client
     believes.
     ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const storedToken = readStored(TOKEN_KEY);

      if (!storedToken) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      // Show the cached identity immediately so the shell can render without a
      // blank frame, then confirm it against the server.
      const cachedUser = readStored(USER_KEY);
      if (cachedUser && !cancelled) {
        try {
          setUser(JSON.parse(cachedUser) as AuthUser);
        } catch {
          // Corrupt cache entry: ignore it and wait for the server's answer.
        }
      }

      try {
        const data = await api<{ user: AuthUser }>("/auth/me", { token: storedToken });
        if (cancelled) return;
        setToken(storedToken);
        setUser(data.user);
        setStatus("authenticated");
        try {
          const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
          store.setItem(USER_KEY, JSON.stringify(data.user));
        } catch {
          // Cache refresh is best-effort.
        }
      } catch (error) {
        if (cancelled) return;

        // Only a token the server actively rejected is a dead session. A
        // network failure, a rate limit, or a server fault are all transient —
        // signing the user out over any of them would evict them for a problem
        // that is not theirs and that fixes itself. 401 and 403 are the only
        // answers that mean "this token is no longer good".
        const transient =
          error instanceof ApiError && (error.isNetworkError || error.status === 429 || error.status >= 500);

        if (transient) {
          setToken(storedToken);
          setStatus("authenticated");
          return;
        }

        clearStored();
        setToken(null);
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const data = await api<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      // Start from a clean cache so nothing from a previous account leaks in.
      queryClient.clear();
      persist(data.token, data.user, remember);
      return data.user;
    },
    [persist, queryClient]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await api<{ token: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      queryClient.clear();
      persist(data.token, data.user);
      return data.user;
    },
    [persist, queryClient]
  );

  const applyUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    try {
      const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
      store.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // Best-effort cache update.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{ user: AuthUser }>("/auth/me", { token });
      applyUser(data.user);
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) logout();
    }
  }, [token, applyUser, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      isReady: status !== "loading",
      needsProfile: status === "authenticated" && computeNeedsProfile(user),
      login,
      register,
      logout,
      refreshUser,
      applyUser
    }),
    [user, token, status, login, register, logout, refreshUser, applyUser]
  );

  return (
    <AuthContext.Provider value={value}>
      <ThemeAccountSync />
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Keeps the chosen theme attached to the account.
 *
 * On sign-in the account's saved theme wins, so a user meets the same interface
 * on a new device. After that, a local change is pushed back to the server. The
 * local value is applied instantly either way — the network round trip never
 * sits between the click and the colour change.
 */
function ThemeAccountSync() {
  const { user, token, status } = useAuth();
  const { theme, adoptRemoteTheme } = useTheme();
  const adoptedForUser = useRef<string | null>(null);
  const lastPushed = useRef<string | null>(null);

  const savedTheme = user?.preferences?.theme;

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      adoptedForUser.current = null;
      lastPushed.current = null;
      return;
    }

    if (adoptedForUser.current === user.id) return;
    adoptedForUser.current = user.id;

    if (isThemeName(savedTheme)) {
      lastPushed.current = savedTheme;
      adoptRemoteTheme(savedTheme);
    } else {
      // No saved preference yet: whatever they are using now becomes theirs.
      lastPushed.current = null;
    }
  }, [status, user, savedTheme, adoptRemoteTheme]);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    if (adoptedForUser.current !== user?.id) return;
    if (lastPushed.current === theme) return;

    lastPushed.current = theme;
    api("/users/me", {
      method: "PATCH",
      token,
      body: JSON.stringify({ preferences: { theme } })
    }).catch(() => {
      // The theme is already applied and cached locally. Failing to record the
      // preference server-side is not worth interrupting the user for.
      lastPushed.current = null;
    });
  }, [theme, status, token, user?.id]);

  return null;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
