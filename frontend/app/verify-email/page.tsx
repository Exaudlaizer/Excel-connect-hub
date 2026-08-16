"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") || ""; const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle"); const [message, setMessage] = useState(""); const [email, setEmail] = useState(""); const [resending, setResending] = useState(false);
  async function verify() { if (!token) return; setState("loading"); try { const data = await api<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }); setMessage(data.message); setState("success"); } catch (err) { setMessage(err instanceof Error ? err.message : "We could not verify that link."); setState("error"); } }
  async function resend(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setResending(true); try { const data = await api<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }); setMessage(data.message); } catch (err) { setMessage(err instanceof Error ? err.message : "We could not send another link."); } finally { setResending(false); } }
  if (state === "success") return <div className="text-center" role="status"><span className="auth-success-icon mx-auto"><CheckCircle2 size={27} /></span><h2 className="auth-title mt-5">Email verified.</h2><p className="auth-copy mt-3">{message}</p><Link href="/login" className="auth-primary-button mt-6">Continue to sign in</Link></div>;
  return <><div className={state === "error" || !token ? "auth-error" : "auth-notice"}>{state === "error" || !token ? <TriangleAlert size={18} /> : <Mail size={18} />}<span>{message || (token ? "Confirm your email to complete this security step." : "This verification link is missing or incomplete.")}</span></div>{token && <button onClick={verify} disabled={state === "loading"} className="auth-primary-button mt-6">{state === "loading" && <Loader2 className="animate-spin" size={18} />}{state === "loading" ? "Verifying..." : "Verify email"}</button>}<form onSubmit={resend} className="mt-7 border-t border-white/10 pt-6"><label className="auth-label" htmlFor="resend-email"><span>Need another link?</span><input id="resend-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="auth-input" placeholder="you@example.com" required /></label><button disabled={resending} className="auth-secondary-button mt-3">{resending && <Loader2 className="animate-spin" size={17} />}{resending ? "Sending..." : "Resend verification link"}</button></form></>;
}

export default function VerifyEmailPage() { return <AuthShell eyebrow="Account confirmation"><div className="auth-card"><p className="auth-kicker">Email confirmation</p><h1 className="auth-title">Confirm it&apos;s you.</h1><p className="auth-copy">A quick security step for a more trusted community.</p><div className="mt-7"><Suspense fallback={<p className="text-sm text-slate-400">Opening confirmation...</p>}><VerifyEmailContent /></Suspense></div></div></AuthShell>; }
