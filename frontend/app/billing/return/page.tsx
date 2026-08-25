"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Where the gateway sends the user back after paying.
 *
 * The URL parameters are only a hint. This page hands the reference to the
 * server, which verifies it against the gateway before changing anything — so a
 * user cannot upgrade themselves by editing this URL. The outcome shown here is
 * whatever that verified check returned.
 */

function ReturnContent() {
  const params = useSearchParams();
  const { token, status, refreshUser } = useAuth();
  const [state, setState] = useState<"checking" | "active" | "failed">("checking");
  const [message, setMessage] = useState("Confirming your payment…");
  const ran = useRef(false);

  useEffect(() => {
    // The token is read from storage during auth bootstrap; confirming before
    // that finishes would send an unauthenticated request.
    if (status === "loading") return;
    if (ran.current) return;
    ran.current = true;

    if (status === "unauthenticated") {
      setState("failed");
      setMessage("Please sign in to confirm your payment, then return to billing.");
      return;
    }

    const txRef = params.get("tx_ref");
    const transactionId = params.get("transaction_id");
    const gatewayStatus = params.get("status");

    if (!txRef || gatewayStatus === "cancelled") {
      setState("failed");
      setMessage(gatewayStatus === "cancelled" ? "The payment was cancelled. Nothing was charged." : "We could not find that payment.");
      return;
    }

    api<{ status: string; message: string }>("/billing/confirm", {
      method: "POST",
      token,
      body: JSON.stringify({ txRef, transactionId })
    })
      .then(async (data) => {
        await refreshUser();
        setState("active");
        setMessage(data.message);
      })
      .catch((err) => {
        setState("failed");
        setMessage(err instanceof ApiError ? err.message : "We could not confirm that payment.");
      });
  }, [params, token, status, refreshUser]);

  return (
    <div className="card card-pad-lg mx-auto max-w-md text-center">
      {state === "checking" && (
        <>
          <Loader2 className="mx-auto animate-spin text-brand" size={30} aria-hidden />
          <p className="mt-5 text-sm text-muted">{message}</p>
        </>
      )}

      {state === "active" && (
        <>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-successSurface text-success">
            <CheckCircle2 size={26} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">Payment confirmed</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
          <Link href="/settings" className="btn btn-primary focus-ring mt-6">
            View your plan
          </Link>
        </>
      )}

      {state === "failed" && (
        <>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-dangerSurface text-danger">
            <AlertTriangle size={26} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">Payment not confirmed</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            If you were charged, contact support with the time of payment and nothing will be lost.
          </p>
          <Link href="/settings" className="btn btn-secondary focus-ring mt-6">
            Back to billing
          </Link>
        </>
      )}
    </div>
  );
}

export default function BillingReturnPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Suspense fallback={<Loader2 className="animate-spin text-brand" size={28} aria-hidden />}>
        <ReturnContent />
      </Suspense>
    </main>
  );
}
