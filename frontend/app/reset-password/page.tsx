"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));

    // Checked here rather than server-side: the confirmation field exists only
    // to catch typos, so there is nothing for the API to validate.
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
      setTimeout(() => router.push("/"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setLoading(false);
    }
  }

  // Someone opened /reset-password directly, with no link.
  if (!token) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-start gap-3 rounded-md bg-red-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 shrink-0 text-red-600" size={18} />
          <p className="text-sm text-red-700">
            This page needs a reset link. Request one from the &ldquo;Forgot password&rdquo; page.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="focus-ring mt-6 flex items-center justify-center rounded-md bg-brand px-4 py-3 font-semibold text-night shadow-gold hover:bg-brandDark"
        >
          Request a reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-start gap-3 rounded-md bg-brand/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
          <p className="text-sm text-ink">Password updated. Taking you to the login page...</p>
        </div>
        <Link
          href="/"
          className="focus-ring mt-6 flex items-center justify-center rounded-md border border-line px-4 py-3 font-semibold text-ink hover:bg-slate-50"
        >
          Go to login now
        </Link>
      </div>
    );
  }

  return (
    <form className="animate-fade-in space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">
        New password
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirm new password
        <input
          name="confirm"
          type="password"
          minLength={8}
          autoComplete="new-password"
          className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2"
          required
        />
      </label>
      <p className="text-xs text-muted">Must be at least 8 characters.</p>
      {error && <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        disabled={loading}
        className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 font-semibold text-night shadow-gold transition-all duration-200 hover:bg-brandDark active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="animate-spin" size={18} />}
        {loading ? "Updating..." : "Update password"}
      </button>
      <Link
        href="/"
        className="focus-ring flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to login
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-line bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="text-lg font-bold text-ink">Choose a new password</h1>
            <p className="text-sm text-muted">Your reset link is single-use.</p>
          </div>
        </div>
        {/* useSearchParams needs a Suspense boundary or the static build fails. */}
        <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
