"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const email = String(new FormData(event.currentTarget).get("email"));

    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      // The API deliberately does not reveal whether the address exists, so the
      // UI shows the same confirmation either way.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-line bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="text-lg font-bold text-ink">Reset your password</h1>
            <p className="text-sm text-muted">We&apos;ll send you a link to choose a new one.</p>
          </div>
        </div>

        {sent ? (
          <div className="animate-fade-in">
            <div className="flex items-start gap-3 rounded-md bg-brand/10 px-4 py-3">
              <MailCheck className="mt-0.5 shrink-0 text-brand" size={18} />
              <p className="text-sm text-ink">
                If that email is registered, a reset link is on its way. The link expires in 60 minutes.
              </p>
            </div>
            <p className="mt-4 text-xs text-muted">
              Developer note: with no SMTP configured, the reset link is printed to the backend console.
            </p>
            <Link
              href="/"
              className="focus-ring mt-6 flex items-center justify-center gap-2 rounded-md border border-line px-4 py-3 font-semibold text-ink transition-colors hover:bg-slate-50"
            >
              <ArrowLeft size={16} /> Back to login
            </Link>
          </div>
        ) : (
          <form className="animate-fade-in space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2"
                required
              />
            </label>
            {error && <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button
              disabled={loading}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 font-semibold text-night shadow-gold transition-all duration-200 hover:bg-brandDark active:scale-[0.98] disabled:opacity-60"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link
              href="/"
              className="focus-ring flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-ink"
            >
              <ArrowLeft size={16} /> Back to login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
