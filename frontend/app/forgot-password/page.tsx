"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ApiError, api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We could not send the reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Account recovery">
      <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">Password recovery</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Reset your password.</h1>
      <p className="mt-2.5 text-sm leading-6 text-muted">
        Enter your email and we will send a secure, single-use link.
      </p>

      {sent ? (
        <div className="animate-fade-rise mt-8">
          <div className="alert alert-success" role="status">
            <MailCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              If that email is registered, a reset link is on its way. It expires in 60 minutes and can only be used
              once.
            </span>
          </div>
          <Link href="/login" className="btn btn-secondary focus-ring mt-6 w-full">
            <ArrowLeft size={16} aria-hidden /> Back to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              className={`field ${error ? "border-danger" : ""}`}
            />
          </div>

          {error && (
            <p className="alert alert-error" role="alert">
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary focus-ring w-full">
            {loading && <Loader2 className="animate-spin" size={17} aria-hidden />}
            {loading ? "Sending link…" : "Send reset link"}
          </button>

          <Link href="/login" className="focus-ring mx-auto flex w-fit items-center gap-1.5 rounded text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft size={15} aria-hidden /> Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
