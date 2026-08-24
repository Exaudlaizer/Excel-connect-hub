"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Wrapper for the sign-in and sign-up screens.
 *
 * Sends an already-authenticated visitor to their dashboard instead of showing
 * them a form they do not need, and provides the Suspense boundary the panel
 * requires for reading the ?next= parameter.
 */
export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-[18rem] items-center justify-center" role="status">
        <Loader2 className="animate-spin text-brand" size={24} aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return <Suspense fallback={<div className="min-h-[18rem]" />}>{children}</Suspense>;
}
