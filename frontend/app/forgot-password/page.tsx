"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try { await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: new FormData(event.currentTarget).get("email") }) }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : "We could not send the reset link."); }
    finally { setLoading(false); }
  }
  return <AuthShell eyebrow="Account recovery"><div className="auth-card">
    <p className="auth-kicker">Password recovery</p><h1 className="auth-title">Reset your password.</h1><p className="auth-copy">Enter your email and we&apos;ll send a secure, single-use link.</p>
    {sent ? <div className="mt-7 animate-fade-in"><div className="auth-notice"><MailCheck size={19} /><span>If that email is registered, a reset link is on its way. It expires in 60 minutes.</span></div><Link href="/login" className="auth-secondary-button mt-6"><ArrowLeft size={17} /> Back to sign in</Link></div> : <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
      <label className="auth-label" htmlFor="email"><span>Email address</span><input id="email" name="email" autoComplete="email" type="email" className="auth-input" required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={loading} className="auth-primary-button">{loading && <Loader2 className="animate-spin" size={18} />}{loading ? "Sending link..." : "Send reset link"}</button>
      <Link href="/login" className="auth-inline-back focus-ring-dark"><ArrowLeft size={16} /> Back to sign in</Link>
    </form>}
  </div></AuthShell>;
}
