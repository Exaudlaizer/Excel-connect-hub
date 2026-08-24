"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ApiError, api } from "@/lib/api";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function verify() {
    if (!token) return;
    setState("loading");
    try {
      const data = await api<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token })
      });
      setMessage(data.message);
      setState("success");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "We could not verify that link.");
      setState("error");
    }
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResending(true);
    setResendMessage("");
    try {
      const data = await api<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setResendMessage(data.message);
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : "We could not send another link.");
    } finally {
      setResending(false);
    }
  }

  if (state === "success") {
    return (
      <div className="animate-fade-rise mt-8 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-successSurface text-success">
          <CheckCircle2 size={26} aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-ink">Email verified.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
        <Link href="/login" className="btn btn-primary focus-ring mt-6 w-full">
          Continue to sign in
        </Link>
      </div>
    );
  }

  const problem = state === "error" || !token;

  return (
    <div className="mt-8">
      <div className={`alert ${problem ? "alert-error" : "alert-info"}`} role={problem ? "alert" : "status"}>
        {problem ? (
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
        ) : (
          <Mail size={18} className="mt-0.5 shrink-0" aria-hidden />
        )}
        <span>
          {message ||
            (token
              ? "Confirm your email to complete this security step."
              : "This verification link is missing or incomplete.")}
        </span>
      </div>

      {token && (
        <button onClick={verify} disabled={state === "loading"} className="btn btn-primary focus-ring mt-6 w-full">
          {state === "loading" && <Loader2 className="animate-spin" size={17} aria-hidden />}
          {state === "loading" ? "Verifying…" : "Verify email"}
        </button>
      )}

      <form onSubmit={resend} className="mt-8 border-t border-line pt-6">
        <label className="field-label" htmlFor="resend-email">
          Need another link?
        </label>
        <input
          id="resend-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          className="field"
          placeholder="you@example.com"
          required
        />
        {resendMessage && (
          <p className="alert alert-info mt-3" role="status">
            <Mail size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{resendMessage}</span>
          </p>
        )}
        <button type="submit" disabled={resending} className="btn btn-secondary focus-ring mt-3 w-full">
          {resending && <Loader2 className="animate-spin" size={16} aria-hidden />}
          {resending ? "Sending…" : "Resend verification link"}
        </button>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="Account confirmation">
      <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">Email confirmation</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Confirm it is you.</h1>
      <p className="mt-2.5 text-sm leading-6 text-muted">A quick security step for a more trusted community.</p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Opening confirmation…</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
