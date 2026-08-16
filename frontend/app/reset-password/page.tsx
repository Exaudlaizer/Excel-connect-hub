"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter(); const token = useSearchParams().get("token") || "";
  const [done, setDone] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) { setError("The two passwords do not match."); return; }
    setLoading(true); try { await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); setDone(true); setTimeout(() => router.push("/login"), 2500); }
    catch (err) { setError(err instanceof Error ? err.message : "We could not reset the password."); } finally { setLoading(false); }
  }
  if (!token) return <><div className="auth-error"><TriangleAlert size={18} /> This page needs a reset link. Request a new one to continue.</div><Link href="/forgot-password" className="auth-primary-button mt-6">Request a reset link</Link></>;
  if (done) return <div className="text-center" role="status"><span className="auth-success-icon mx-auto"><CheckCircle2 size={27} /></span><h2 className="auth-title mt-5">Password updated.</h2><p className="auth-copy mt-3">Taking you to sign in securely.</p><Link href="/login" className="auth-secondary-button mt-6">Sign in now</Link></div>;
  return <form className="mt-7 space-y-4" onSubmit={submit} noValidate><PasswordInput label="New password" name="password" autoComplete="new-password" minLength={8} required hint="Use at least 8 characters." /><PasswordInput label="Confirm new password" name="confirm" autoComplete="new-password" minLength={8} required />{error && <p className="auth-error" role="alert">{error}</p>}<button disabled={loading} className="auth-primary-button">{loading && <Loader2 className="animate-spin" size={18} />}{loading ? "Updating..." : "Update password"}</button><Link href="/login" className="auth-inline-back focus-ring-dark"><ArrowLeft size={16} /> Back to sign in</Link></form>;
}

export default function ResetPasswordPage() { return <AuthShell eyebrow="Secure password reset"><div className="auth-card"><p className="auth-kicker">Choose a new password</p><h1 className="auth-title">Set a fresh password.</h1><p className="auth-copy">This secure link can only be used once.</p><Suspense fallback={<p className="mt-7 text-sm text-slate-400">Preparing your secure form...</p>}><ResetPasswordForm /></Suspense></div></AuthShell>; }
