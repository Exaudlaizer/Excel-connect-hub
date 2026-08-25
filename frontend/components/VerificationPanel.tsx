"use client";

import { useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, Loader2, Mail, Phone, RotateCw, ShieldCheck } from "lucide-react";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * In-app confirmation for the email address and the phone number.
 *
 * Both codes are delivered by email. For the phone that is stated plainly
 * rather than implied: the platform has no SMS gateway, so confirming a number
 * records that the account holder deliberately confirmed it — it does not prove
 * the handset was reached. Saying so is more useful than a checkmark that means
 * less than it looks like.
 */

const RESEND_SECONDS = 60;

type Purpose = "email" | "phone";

function Row({
  purpose,
  value,
  verified,
  disabledReason
}: {
  purpose: Purpose;
  value: string | null | undefined;
  verified: boolean;
  disabledReason?: string;
}) {
  const { token, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const Icon = purpose === "phone" ? Phone : Mail;
  const label = purpose === "phone" ? "Phone number" : "Email address";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    setError("");
    setNotice("");
    setSending(true);

    try {
      const data = await api<{ message: string; alreadyVerified?: boolean }>("/auth/verification/request", {
        method: "POST",
        token,
        body: JSON.stringify({ purpose })
      });

      if (data.alreadyVerified) {
        await refreshUser();
        setOpen(false);
        return;
      }

      setNotice(data.message);
      setOpen(true);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setCooldown(err.retryAfter ?? RESEND_SECONDS);
      setError(err instanceof ApiError ? err.message : "We could not send a code. Please try again.");
      if (err instanceof ApiError && err.status === 429) setOpen(true);
    } finally {
      setSending(false);
    }
  }

  async function confirm(submitted?: string) {
    const entered = submitted || code;
    if (entered.length !== 6) return setError("Enter all six digits.");

    setError("");
    setChecking(true);

    try {
      await api("/auth/verification/confirm", {
        method: "POST",
        token,
        body: JSON.stringify({ purpose, code: entered })
      });
      await refreshUser();
      setOpen(false);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code could not be confirmed.");
      setCode("");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              verified ? "bg-successSurface text-success" : "bg-secondary text-muted"
            }`}
          >
            {verified ? <BadgeCheck size={17} aria-hidden /> : <Icon size={17} aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{label}</p>
            <p className="truncate text-sm text-muted">{value || <span className="italic">Not set</span>}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {verified ? (
            <span className="badge badge-success">Confirmed</span>
          ) : (
            <>
              <span className="badge badge-warning">Unconfirmed</span>
              {!disabledReason && !open && (
                <button type="button" onClick={send} disabled={sending} className="btn btn-primary btn-sm focus-ring">
                  {sending && <Loader2 className="animate-spin" size={14} aria-hidden />}
                  {sending ? "Sending…" : "Send code"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!verified && disabledReason && (
        <p className="mt-3 text-xs leading-5 text-muted">{disabledReason}</p>
      )}

      {open && !verified && (
        <div className="animate-fade-rise mt-5 border-t border-line pt-5">
          {notice && !error && (
            <p className="alert alert-info mb-4" role="status">
              <Mail size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{notice}</span>
            </p>
          )}

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(entered) => confirm(entered)}
            disabled={checking}
            invalid={Boolean(error)}
            label={`Code for your ${purpose === "phone" ? "phone number" : "email address"}`}
          />

          {error && (
            <p className="alert alert-error mt-3" role="alert">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => confirm()}
              disabled={checking || code.length !== 6}
              className="btn btn-primary focus-ring"
            >
              {checking && <Loader2 className="animate-spin" size={16} aria-hidden />}
              {checking ? "Confirming…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || cooldown > 0}
              className="btn btn-secondary focus-ring"
            >
              <RotateCw size={15} aria-hidden />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCode("");
                setError("");
              }}
              className="btn btn-ghost focus-ring"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VerificationPanel() {
  const { user } = useAuth();
  if (!user) return null;

  const bothDone = user.emailVerified && (user.phoneVerified || !user.phone);

  return (
    <section>
      <h2 className="text-heading text-ink">Verification</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Confirming your details keeps the community trustworthy and lets us reach you about applications.
      </p>

      <div className="mt-6 space-y-3">
        <Row purpose="email" value={user.email} verified={Boolean(user.emailVerified)} />
        <Row
          purpose="phone"
          value={user.phone}
          verified={Boolean(user.phoneVerified)}
          disabledReason={
            user.phone
              ? undefined
              : "Add a phone number on your profile first, then come back to confirm it."
          }
        />
      </div>

      <div className={`alert mt-6 ${bothDone ? "alert-success" : "alert-info"}`}>
        <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {bothDone
            ? "Your account details are confirmed."
            : "Codes are sent to your email address — including the one for your phone number, since the platform does not send SMS. Confirming a number records that you own it, not that the handset was reached."}
        </span>
      </div>
    </section>
  );
}
