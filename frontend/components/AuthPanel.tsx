"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Building2, ShieldCheck, Loader2 } from "lucide-react";
import { Role, useAuth } from "@/lib/auth";

// The "youth" role maps to the backend `student` value so the API/DB stay unchanged.
const roles: Array<{ value: Role; label: string; icon: React.ElementType }> = [
  { value: "student", label: "Youth", icon: GraduationCap },
  { value: "company", label: "Company", icon: Building2 },
  { value: "admin", label: "Admin", icon: ShieldCheck }
];

export function AuthPanel() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("name") || "");

    try {
      if (mode === "login") await login(email, password);
      else await register({ name, email, password, role });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md animate-slide-up rounded-2xl border border-line bg-card p-6 shadow-soft">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
        {(["register", "login"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
              mode === item ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* key on `mode` so the fields re-animate each time you switch */}
      <form key={mode} className="animate-fade-in space-y-4" onSubmit={submit}>
        {mode === "register" && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input name="name" className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2" required />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">I am joining as</p>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((item) => {
                  const Icon = item.icon;
                  const active = role === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`focus-ring rounded-lg border px-2 py-3 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        active ? "border-brand bg-brand/10 text-brand shadow-gold" : "border-line text-slate-600 hover:border-brand/50"
                      }`}
                      onClick={() => setRole(item.value)}
                    >
                      <Icon className={`mx-auto mb-1 transition-transform ${active ? "scale-110" : ""}`} size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input name="password" type="password" minLength={8} className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2" required />
        </label>
        {error && <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          disabled={loading}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 font-semibold text-night shadow-gold transition-all duration-200 hover:bg-brandDark hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="animate-spin" size={18} />}
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>
    </div>
  );
}
