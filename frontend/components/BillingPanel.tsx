"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BadgeCheck, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Plans and subscription.
 *
 * The platform is free today, so this reads as "here is your Free plan, and here
 * is what paid plans will offer" rather than a hard sell. When payments are off
 * the upgrade buttons say "Coming soon" and do nothing; when on, they start a
 * hosted checkout and the page reacts to the result.
 */

type Plan = {
  key: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  isFree: boolean;
};

type Subscription = { planKey: string; status: string; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean };

function formatPrice(plan: Plan) {
  if (plan.isFree) return "Free";
  return `${plan.currency} ${plan.price.toLocaleString()}`;
}

export function BillingPanel() {
  const { user, token, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api<{ plans: Plan[]; paymentsEnabled: boolean }>("/billing/plans", { token })
  });

  const subscription = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: () => api<{ subscription: Subscription; plan: Plan; paymentsEnabled: boolean }>("/billing/subscription", { token })
  });

  const checkout = useMutation({
    mutationFn: (planKey: string) =>
      api<{ link: string }>("/billing/checkout", { method: "POST", token, body: JSON.stringify({ planKey }) }),
    onSuccess: (data) => {
      // Hand the browser to the gateway's hosted page.
      window.location.assign(data.link);
    },
    onError: (err: unknown) => {
      setBusyKey(null);
      setError(err instanceof ApiError ? err.message : "We could not start checkout. Please try again.");
    }
  });

  const cancel = useMutation({
    mutationFn: () => api("/billing/cancel", { method: "POST", token }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["billing-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing-plans"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not change your plan.")
  });

  const paymentsOn = plans.data?.paymentsEnabled ?? false;
  // Prefer the auth user as the source of truth: refreshUser keeps it current
  // the moment a payment is confirmed, without waiting for this query to refetch.
  const currentKey = user?.planKey || subscription.data?.subscription?.planKey || "free";
  const cancelScheduled = subscription.data?.subscription?.cancelAtPeriodEnd;

  return (
    <section>
      <h2 className="text-heading text-ink">Plans &amp; billing</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Excel Connect Hub is free for students, always. Businesses, employers and mentors can upgrade for more reach.
      </p>

      {!paymentsOn && (
        <div className="alert alert-info mt-5">
          <Sparkles size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Everything is free right now. Paid plans are shown here so you can see what is coming — you will not be
            charged, and there is nothing to do.
          </span>
        </div>
      )}

      {cancelScheduled && (
        <div className="alert alert-info mt-5">
          <BadgeCheck size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>Your plan will move to Free at the end of the current period.</span>
        </div>
      )}

      {error && (
        <p className="alert alert-error mt-5" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {plans.isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-pad">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} title="We could not load plans" />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(plans.data?.plans || []).map((plan, index) => {
            const current = plan.key === currentKey;
            return (
              <article
                key={plan.key}
                className={`stagger-item card card-pad flex flex-col ${current ? "border-brand" : ""}`}
                style={{ ["--stagger-index" as string]: index }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                  {current && <span className="badge badge-primary">Current</span>}
                </div>

                <p className="mt-3">
                  <span className="font-display text-3xl font-bold text-ink">{formatPrice(plan)}</span>
                  {!plan.isFree && <span className="text-sm text-muted"> / {plan.interval}</span>}
                </p>

                {plan.description && <p className="mt-2 text-sm leading-6 text-muted">{plan.description}</p>}

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                      <Check size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {current ? (
                    plan.isFree ? (
                      <button type="button" disabled className="btn btn-secondary focus-ring w-full">
                        Your plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cancel.mutate()}
                        disabled={cancel.isPending || cancelScheduled}
                        className="btn btn-secondary focus-ring w-full"
                      >
                        {cancel.isPending && <Loader2 className="animate-spin" size={15} aria-hidden />}
                        {cancelScheduled ? "Downgrade scheduled" : "Move to Free"}
                      </button>
                    )
                  ) : plan.isFree ? (
                    <span className="block py-2 text-center text-sm text-muted">Included with every account</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!paymentsOn) return;
                        setError("");
                        setBusyKey(plan.key);
                        checkout.mutate(plan.key);
                      }}
                      disabled={!paymentsOn || busyKey === plan.key}
                      className="btn btn-primary focus-ring w-full"
                      title={paymentsOn ? undefined : "Paid plans are not available yet"}
                    >
                      {busyKey === plan.key ? (
                        <Loader2 className="animate-spin" size={15} aria-hidden />
                      ) : (
                        <CreditCard size={15} aria-hidden />
                      )}
                      {paymentsOn ? `Upgrade to ${plan.name}` : "Coming soon"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-muted">
        Payments are processed securely by Flutterwave, including mobile money (M-Pesa, Tigo Pesa, Airtel) and cards.
        Excel Connect Hub never sees your card or mobile-money credentials.
      </p>
    </section>
  );
}
