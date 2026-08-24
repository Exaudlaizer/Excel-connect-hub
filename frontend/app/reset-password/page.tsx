"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ApiError, api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";

  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    const found: typeof errors = {};
    if (password.length < 8) found.password = "Use at least 8 characters.";
    if (password !== confirm) found.confirm = "The two passwords do not match.";

    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2200);
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "We could not reset the password. Please try again." });
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-8">
        <div className="alert alert-error" role="alert">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>This page needs a reset link. Request a new one to continue.</span>
        </div>
        <Link href="/forgot-password" className="btn btn-primary focus-ring mt-6 w-full">
          Request a reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="animate-fade-rise mt-8 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-successSurface text-success">
          <CheckCircle2 size={26} aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-ink">Password updated.</h2>
        <p className="mt-2 text-sm text-muted">Taking you to sign in…</p>
        <Link href="/login" className="btn btn-secondary focus-ring mt-6 w-full">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
      <PasswordInput
        label="New password"
        name="password"
        autoComplete="new-password"
        hint="Use at least 8 characters."
        error={errors.password}
      />
      <PasswordInput label="Confirm new password" name="confirm" autoComplete="new-password" error={errors.confirm} />

      {errors.form && (
        <p className="alert alert-error" role="alert">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{errors.form}</span>
        </p>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary focus-ring w-full">
        {loading && <Loader2 className="animate-spin" size={17} aria-hidden />}
        {loading ? "Updating…" : "Update password"}
      </button>

      <Link href="/login" className="focus-ring mx-auto flex w-fit items-center gap-1.5 rounded text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell eyebrow="Secure password reset">
      <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">Choose a new password</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Set a fresh password.</h1>
      <p className="mt-2.5 text-sm leading-6 text-muted">This secure link can only be used once.</p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Preparing your secure form…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
