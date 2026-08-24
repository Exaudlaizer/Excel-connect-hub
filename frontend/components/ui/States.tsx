"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { ApiError } from "@/lib/api";

/* ---------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------
   Skeletons mirror the shape of the content that is coming, so the layout does
   not jump when the data lands. A blank screen is never shown.
   ------------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <Skeleton className="mt-5 h-9 w-28 rounded-lg" />
    </div>
  );
}

export function CardGridSkeleton({ count = 4, className = "grid gap-4 md:grid-cols-2" }: { count?: number; className?: string }) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card flex items-center gap-3 p-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Empty
   -------------------------------------------------------------------------
   Shown when a request succeeded and there genuinely is nothing yet. This is
   deliberately never filled with sample rows: an empty section says so.
   ------------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Error
   -------------------------------------------------------------------------
   Never renders a raw server or driver message. The API client has already
   translated the status into something a person can act on; this adds the way
   out — a retry button.
   ------------------------------------------------------------------------ */

export function ErrorState({
  error,
  onRetry,
  title = "We could not load this"
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const isOffline = error instanceof ApiError && error.isNetworkError;
  const message =
    error instanceof ApiError
      ? error.message
      : "Something went wrong while loading this section. Please try again.";

  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center" role="alert">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-dangerSurface text-danger">
        {isOffline ? <WifiOff size={22} aria-hidden /> : <AlertTriangle size={22} aria-hidden />}
      </span>
      <p className="text-base font-bold text-ink">{isOffline ? "You appear to be offline" : title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm focus-ring mt-5">
          <RefreshCw size={15} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Query wrapper
   -------------------------------------------------------------------------
   One place that decides between loading, error, empty, and content — so no
   page can accidentally skip a state and render a blank area.
   ------------------------------------------------------------------------ */

export function QueryBoundary<T>({
  isLoading,
  isError,
  error,
  onRetry,
  data,
  isEmpty,
  skeleton,
  empty,
  children
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  skeleton?: React.ReactNode;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (isLoading) return <>{skeleton ?? <CardGridSkeleton />}</>;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined) return <>{empty ?? null}</>;
  if (isEmpty?.(data)) return <>{empty ?? null}</>;
  return <>{children(data)}</>;
}
