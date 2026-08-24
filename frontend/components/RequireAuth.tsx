"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Role, useAuth } from "@/lib/auth";

/**
 * Gate for pages that need a signed-in account.
 *
 * This is a usability guard, not the security boundary. It stops a signed-out
 * visitor from seeing an empty shell and a page full of failed requests. The
 * actual protection is server-side: every endpoint behind `protect` verifies the
 * JWT and re-reads the account on every request, so nothing here can be bypassed
 * by editing localStorage or calling the route directly.
 */
export function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    // Remember where they were headed so signing in returns them there.
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-brand" size={26} aria-hidden />
          <p className="text-sm text-muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6" role="status">
        <p className="text-sm text-muted">Redirecting you to sign in…</p>
      </div>
    );
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="card max-w-md px-6 py-10 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-dangerSurface text-danger">
            <ShieldAlert size={22} aria-hidden />
          </span>
          <p className="text-base font-bold text-ink">This area is not available to your account</p>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Your account is signed in as {user.role}. If you think this is wrong, contact an administrator.
          </p>
          <Link href="/dashboard" className="btn btn-primary focus-ring mt-6">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
