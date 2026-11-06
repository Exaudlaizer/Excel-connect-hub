"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { PageMeta, Pagination } from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AuditEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};

// What each recorded action means, in words. Anything not listed falls back to
// the raw action name, so a new action never renders as a blank.
const ACTION_LABELS: Record<string, string> = {
  "job.status": "Changed an opportunity's approval status",
  "job.update": "Edited someone else's opportunity",
  "job.delete": "Deleted someone else's opportunity",
  "ad.status": "Changed an advertisement's approval status",
  "ad.update": "Edited someone else's advertisement",
  "ad.delete": "Deleted someone else's advertisement",
  "course.status": "Changed a course's approval status",
  "course.update": "Edited someone else's course",
  "course.delete": "Deleted someone else's course",
  "user.status": "Suspended or reinstated an account",
  "user.role": "Changed an account's role",
  "service.create": "Added a service",
  "service.update": "Edited a service",
  "service.delete": "Removed a service",
  "community.pin": "Pinned or unpinned a post",
  "community.post.delete": "Removed someone's post",
  "community.reply.delete": "Removed someone's reply",
  "auth.logout_all": "Signed out of every device",
  "auth.password_reset": "Reset a password",
  "billing.verification_failed": "A payment did not match what was charged"
};

const FILTERS = [{ value: "", label: "All activity" }, ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))];

// Short, readable summary of the small facts stored with an entry. Rendered as
// plain text only, never as markup.
function summarise(details: Record<string, unknown>) {
  return Object.entries(details || {})
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export function AdminAudit() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const log = useQuery({
    queryKey: ["admin-audit", action, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set("action", action);
      return api<{ logs: AuditEntry[]; pagination: PageMeta }>(`/admin/audit?${params}`, { token });
    }
  });

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-heading text-ink">Activity</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
            A record of administrator decisions and security events: who did what, to what, and when. Entries cannot be
            edited or removed.
          </p>
        </div>
        <label className="text-sm text-muted">
          <span className="sr-only">Filter by activity</span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="field focus-ring"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        {log.isLoading && <ListSkeleton rows={6} />}
        {log.isError && <ErrorState error={log.error} onRetry={() => log.refetch()} title="We could not load the activity log" />}
        {log.data && log.data.logs.length === 0 && (
          <EmptyState icon={ScrollText} title="Nothing recorded yet" description="Approvals, suspensions, role changes and other administrator actions will appear here." />
        )}

        {log.data && log.data.logs.length > 0 && (
          <ul className="divide-y divide-line card" aria-label="Activity log">
            {log.data.logs.map((entry) => (
              <li key={entry.id} className="px-4 py-3.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold text-ink">{ACTION_LABELS[entry.action] || entry.action}</p>
                  <time dateTime={entry.createdAt} className="text-xs text-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-muted">
                  <span className="break-all">{entry.actorEmail || "System"}</span>
                  {entry.targetType && (
                    <>
                      {" "}
                      · {entry.targetType} <span className="break-all font-mono text-xs">{entry.targetId}</span>
                    </>
                  )}
                </p>
                {summarise(entry.details) && <p className="mt-1 break-words text-xs text-muted">{summarise(entry.details)}</p>}
              </li>
            ))}
          </ul>
        )}

        <Pagination meta={log.data?.pagination} onChange={setPage} label="entries" />
      </div>
    </section>
  );
}
