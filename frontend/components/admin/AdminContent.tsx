"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookOpen, BriefcaseBusiness, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Moderation and editing for the two kinds of content the platform hosts on
 * someone else's behalf: employer opportunities and mentor courses.
 *
 * The two share a shape — a list, a status, an approve/reject decision, and an
 * editor — so they share an implementation. What differs is described in the
 * config object below rather than duplicated in two components.
 */

type Row = {
  _id: string;
  id: string;
  title: string;
  status: string;
  [key: string]: unknown;
};

type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  options?: readonly string[];
  required?: boolean;
  span?: boolean;
};

type Config = {
  key: string;
  endpoint: string;
  listKey: string;
  icon: React.ElementType;
  label: string;
  statuses: readonly string[];
  approvalStatuses: readonly string[];
  emptyText: string;
  meta: (row: Row) => string;
  fields: FieldSpec[];
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
  closed: "badge",
  archived: "badge"
};

const JOBS: Config = {
  key: "jobs",
  endpoint: "/jobs",
  listKey: "jobs",
  icon: BriefcaseBusiness,
  label: "opportunities",
  statuses: ["", "pending", "approved", "rejected", "closed"],
  approvalStatuses: ["approved", "rejected", "closed"],
  emptyText: "Opportunities posted by employers appear here for review.",
  meta: (row) => {
    const company = row.company as { name?: string; companyProfile?: { companyName?: string } } | undefined;
    return [company?.companyProfile?.companyName || company?.name, row.location, row.type].filter(Boolean).join(" · ");
  },
  fields: [
    { name: "title", label: "Title", required: true },
    { name: "type", label: "Type", type: "select", options: ["job", "internship"] },
    { name: "workMode", label: "Work mode", type: "select", options: ["onsite", "remote", "hybrid"] },
    { name: "location", label: "Location", required: true },
    { name: "salaryRange", label: "Salary range" },
    { name: "description", label: "Description", type: "textarea", required: true, span: true }
  ]
};

const COURSES: Config = {
  key: "courses",
  endpoint: "/courses",
  listKey: "courses",
  icon: BookOpen,
  label: "courses",
  statuses: ["", "pending", "approved", "rejected", "archived"],
  approvalStatuses: ["approved", "rejected", "archived"],
  emptyText: "Courses published by mentors appear here for review.",
  meta: (row) => {
    const provider = row.provider as { name?: string } | undefined;
    return [provider?.name && `by ${provider.name}`, row.category, row.deliveryMode].filter(Boolean).join(" · ");
  },
  fields: [
    { name: "title", label: "Title", required: true },
    { name: "category", label: "Category", required: true },
    { name: "duration", label: "Duration" },
    { name: "price", label: "Price (TZS)", type: "number" },
    { name: "deliveryMode", label: "Delivery", type: "select", options: ["online", "in-person", "hybrid"] },
    { name: "description", label: "Description", type: "textarea", required: true, span: true }
  ]
};

function ModerationList({ config }: { config: Config }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const list = useQuery({
    queryKey: ["admin", config.key, status],
    queryFn: () =>
      api<Record<string, Row[]>>(`${config.endpoint}${status ? `?status=${status}` : ""}`, { token })
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", config.key] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  }

  const setApproval = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api(`${config.endpoint}/${id}/approval`, { method: "PATCH", token, body: JSON.stringify({ status: next }) }),
    onSuccess: refresh
  });

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api(`${config.endpoint}/${id}`, { method: "PATCH", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not save these changes.")
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`${config.endpoint}/${id}`, { method: "DELETE", token }),
    onSuccess: refresh
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};

    for (const field of config.fields) {
      const raw = String(form.get(field.name) || "").trim();
      if (field.required && !raw) return setError(`${field.label} is required.`);
      if (raw) payload[field.name] = field.type === "number" ? Number(raw) : raw;
    }

    // An admin edit keeps the current status rather than sending it back to the
    // queue; the moderator is the one making the change.
    payload.status = String(form.get("status") || editing.status);

    save.mutate({ id: editing.id, payload });
  }

  const rows = list.data?.[config.listKey] || [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {config.statuses.map((item) => (
          <button
            key={item || "all"}
            type="button"
            onClick={() => setStatus(item)}
            aria-pressed={status === item}
            className={`focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
              status === item ? "bg-brand text-night" : "bg-secondary text-muted hover:text-ink"
            }`}
          >
            {item || "All"}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title={`We could not load ${config.label}`} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={status ? `No ${status} ${config.label}` : `No ${config.label} yet`}
          description={config.emptyText}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row._id}
              className="stagger-item card flex flex-wrap items-center gap-3 p-4"
              style={{ ["--stagger-index" as string]: index }}
            >
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${STATUS_BADGE[row.status] || "badge"}`}>{row.status}</span>
                </div>
                <p className="mt-1.5 truncate text-sm font-bold text-ink">{row.title}</p>
                <p className="truncate text-xs text-muted">{config.meta(row)}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { setError(""); setEditing(row); }} className="btn btn-secondary btn-sm focus-ring">
                  <Pencil size={13} aria-hidden /> Edit
                </button>
                {row.status !== "approved" && (
                  <button
                    type="button"
                    disabled={setApproval.isPending}
                    onClick={() => setApproval.mutate({ id: row.id, next: "approved" })}
                    className="btn btn-primary btn-sm focus-ring"
                  >
                    <Check size={13} aria-hidden /> Approve
                  </button>
                )}
                {row.status !== "rejected" && (
                  <button
                    type="button"
                    disabled={setApproval.isPending}
                    onClick={() => {
                      if (confirm(`Reject "${row.title}"? The owner will need to resubmit.`)) {
                        setApproval.mutate({ id: row.id, next: "rejected" });
                      }
                    }}
                    className="btn btn-secondary btn-sm focus-ring"
                  >
                    <X size={13} aria-hidden /> Reject
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${row.title}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Permanently delete "${row.title}"? This cannot be undone.`)) remove.mutate(row.id);
                  }}
                  className="btn btn-secondary btn-sm focus-ring text-danger"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.title || ""}`}
        description="Saved changes take effect immediately."
        size="lg"
      >
        {editing && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {config.fields.map((field) => (
                <div key={field.name} className={field.span ? "sm:col-span-2" : undefined}>
                  <label className="field-label" htmlFor={field.name}>
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      rows={4}
                      defaultValue={String(editing[field.name] ?? "")}
                      className="field"
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={field.name}
                      name={field.name}
                      defaultValue={String(editing[field.name] ?? field.options?.[0] ?? "")}
                      className="field"
                    >
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type === "number" ? "number" : "text"}
                      defaultValue={String(editing[field.name] ?? "")}
                      className="field"
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="field-label" htmlFor="status">
                  Status
                </label>
                <select id="status" name="status" defaultValue={editing.status} className="field">
                  {config.approvalStatuses.concat("pending").map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="alert alert-error" role="alert">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button type="submit" disabled={save.isPending} className="btn btn-primary focus-ring">
                {save.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary focus-ring">
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function AdminJobs() {
  return <ModerationList config={JOBS} />;
}

export function AdminCourses() {
  return <ModerationList config={COURSES} />;
}
