"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, GraduationCap, Building2, Presentation, Loader2, MailCheck } from "lucide-react";
import { SelfServiceRole, useAuth } from "@/lib/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

const roles: Array<{ value: SelfServiceRole; label: string; icon: React.ElementType }> = [
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "company", label: "Employer", icon: Building2 },
  { value: "mentor", label: "Mentor", icon: Presentation }
];

function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length, [password]);
  const label = ["Use 8+ characters", "Getting started", "Good password", "Strong password", "Excellent password"][score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((index) => <span key={index} className={`h-1 rounded-full ${index < score ? "bg-brandLight" : "bg-white/10"}`} />)}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const [role, setRole] = useState<SelfServiceRole>("student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const enteredPassword = String(form.get("password") || "");

    if (mode === "register" && enteredPassword !== String(form.get("confirmPassword") || "")) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, enteredPassword, form.get("remember") === "on");
        window.location.assign("/dashboard");
      } else {
        await register({ name: String(form.get("name") || ""), email, password: enteredPassword, role });
        setComplete(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not complete that request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <div className="auth-card text-center" role="status">
        <span className="auth-success-icon mx-auto"><CheckCircle2 size={27} /></span>
        <p className="auth-kicker">Account created</p>
        <h2 className="auth-title">Welcome to the hub.</h2>
        <p className="auth-copy mt-3">We sent a confirmation link to your email. You can start exploring now, and verify your email when it arrives.</p>
        <div className="auth-notice mt-6 text-left"><MailCheck size={18} /><span>Verification helps protect your account and the student community.</span></div>
        <Link href="/dashboard" className="auth-primary-button mt-6">Continue to dashboard</Link>
      </div>
    );
  }

  const isLogin = mode === "login";
  return (
    <div className="auth-card">
      <p className="auth-kicker">{isLogin ? "Welcome back" : "Create your account"}</p>
      <h2 className="auth-title">{isLogin ? "Continue your progress." : "Start building momentum."}</h2>
      <p className="auth-copy">{isLogin ? "Sign in to access your learning and opportunities." : "Join a focused learning and opportunity network."}</p>

      <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
        {!isLogin && (
          <>
            <label className="auth-label" htmlFor="name"><span>Full name</span><input id="name" name="name" autoComplete="name" className="auth-input" required minLength={2} /></label>
            <fieldset>
              <legend className="auth-label mb-2">I&apos;m joining as</legend>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={`auth-role focus-ring-dark ${role === value ? "auth-role-active" : ""}`}>
                    <Icon size={18} /><span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <label className="auth-label" htmlFor="email"><span>Email address</span><input id="email" name="email" type="email" autoComplete="email" className="auth-input" required /></label>
        <div>
          <PasswordInput label="Password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required onChange={(event) => !isLogin && setPassword(event.target.value)} />
          {!isLogin && <PasswordStrength password={password} />}
        </div>
        {!isLogin && <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={8} required />}

        {isLogin && (
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="auth-check"><input name="remember" type="checkbox" defaultChecked /><span>Keep me signed in</span></label>
            <Link href="/forgot-password" className="auth-text-link focus-ring-dark">Forgot password?</Link>
          </div>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}
        <button disabled={loading} className="auth-primary-button" type="submit">
          {loading && <Loader2 className="animate-spin" size={18} />}
          {loading ? (isLogin ? "Signing in..." : "Creating account...") : (isLogin ? "Sign in securely" : "Create account")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        {isLogin ? "New to Excel Connect Hub?" : "Already have an account?"} {" "}
        <Link href={isLogin ? "/signup" : "/login"} className="auth-text-link focus-ring-dark">{isLogin ? "Create an account" : "Sign in"}</Link>
      </p>
    </div>
  );
}
