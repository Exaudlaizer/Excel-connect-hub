"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Mail, RotateCw } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Email confirmation by code.
 *
 * Works signed in or signed out. A signed-in visitor uses the authenticated
 * endpoints; someone who registered and closed the tab lands here with no
 * session and confirms by entering their address alongside the code.
 */

const RESEND_SECONDS = 60;

function VerifyEmailContent() {
  const params = useSearchParams();
  const { user, token, status, refreshUser } = useAuth();

  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const signedIn = status === "authenticated" && Boolean(token);
  const address = signedIn ? user?.email || "" : email;

  useEffect(() => {
    if (signedIn && user?.email) setEmail(user.email);
  }, [signedIn, user?.email]);

  // A signed-in account that is already confirmed has nothing to do here.
  useEffect(() => {
    if (signedIn && user?.emailVerified) setDone(true);
  }, [signedIn, user?.emailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!signedIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter the email address you registered with.");
      return;
    }

    setError("");
    setNotice("");
    setSending(true);

    try {
      const data = signedIn
        ? await api<{ message: string }>("/auth/verification/request", {
            method: "POST",
            token,
            body: JSON.stringify({ purpose: "email" })
          })
        : await api<{ message: string }>("/auth/verification/request-public", {
            method: "POST",
            body: JSON.stringify({ email })
          });

      setNotice(data.message);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // The server tells us how long is left; honour it rather than guessing.
        setCooldown(err.retryAfter ?? RESEND_SECONDS);
      }
      setError(err instanceof ApiError ? err.message : "We could not send a code. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function confirm(submitted?: string) {
    const entered = submitted || code;
    if (entered.length !== 6) {
      setError("Enter all six digits.");
      return;
    }

    setError("");
    setChecking(true);

    try {
      if (signedIn) {
        await api("/auth/verification/confirm", {
          method: "POST",
          token,
          body: JSON.stringify({ purpose: "email", code: entered })
        });
        await refreshUser();
      } else {
        await api("/auth/verification/confirm-public", {
          method: "POST",
          body: JSON.stringify({ email, code: entered })
        });
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code could not be confirmed.");
      setCode("");
    } finally {
      setChecking(false);
    }
  }

  if (done) {
    return (
      <div className="animate-fade-rise mt-8 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-successSurface text-success">
          <CheckCircle2 size={26} aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-ink">Email confirmed.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {signedIn ? "Your account is fully set up." : "You can sign in now."}
        </p>
        <Link href={signedIn ? "/dashboard" : "/login"} className="btn btn-primary focus-ring mt-6 w-full">
          {signedIn ? "Go to your dashboard" : "Continue to sign in"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {!signedIn && (
        <div className="mb-4">
          <label className="field-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="field"
          />
        </div>
      )}

      <p className="mb-4 text-sm leading-6 text-muted">
        {address ? (
          <>
            Enter the 6-digit code we sent to <strong className="text-ink">{address}</strong>.
          </>
        ) : (
          "Enter your email address, then request a code."
        )}
      </p>

      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          confirm();
        }}
      >
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(entered) => confirm(entered)}
          disabled={checking}
          invalid={Boolean(error)}
          autoFocus={signedIn}
        />

        {error && (
          <p className="alert alert-error mt-4" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        {notice && !error && (
          <p className="alert alert-info mt-4" role="status">
            <Mail size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{notice}</span>
          </p>
        )}

        <button type="submit" disabled={checking || code.length !== 6} className="btn btn-primary focus-ring mt-4 w-full">
          {checking && <Loader2 className="animate-spin" size={17} aria-hidden />}
          {checking ? "Confirming…" : "Confirm email"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-center">
        <p className="text-sm text-muted">Did not get it? Check your spam folder.</p>
        <button
          type="button"
          onClick={sendCode}
          disabled={sending || cooldown > 0}
          className="btn btn-secondary btn-sm focus-ring mt-3"
        >
          {sending ? <Loader2 className="animate-spin" size={15} aria-hidden /> : <RotateCw size={15} aria-hidden />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Send a new code"}
        </button>
      </div>

      {!signedIn && (
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="focus-ring rounded font-bold text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="Account confirmation">
      <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">Email confirmation</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Confirm it is you.</h1>
      <p className="mt-2.5 text-sm leading-6 text-muted">
        A quick security step so we know we can reach you.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Opening confirmation…</p>}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
