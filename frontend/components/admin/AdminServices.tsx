"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LifeBuoy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { PageMeta, Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Service = {
  _id: string;
  id: string;
  name: string;
  category: string;
  description: string;
  provider?: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  url?: string;
  status: "active" | "archived";
};

const CATEGORIES = [
  "academic",
  "career",
  "wellbeing",
  "financial",
  "housing",
  "technology",
  "library",
  "other"
] as const;

const EMPTY: Partial<Service> = { name: "", category: "academic", description: "", status: "active" };

/**
 * The university services directory is written entirely from here — there is no
 * public submission route for it, because it is meant to be a vetted list
 * rather than an open board.
 */
export function AdminServices() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [error, setError] = useState("");

  const services = useQuery({
    queryKey: ["admin-services", page],
    queryFn: () => api<{ services: Service[]; pagination: PageMeta }>(`/services?page=${page}`, { token })
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    queryClient.invalidateQueries({ queryKey: ["services"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  }

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id
        ? api(`/services/${id}`, { method: "PATCH", token, body: JSON.stringify(payload) })
        : api("/services", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not save this service.")
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/services/${id}`, { method: "DELETE", token }),
    onSuccess: refresh
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();

    if (text("name").length < 3) return setError("Enter the service name.");
    if (text("description").length < 10) return setError("Describe the service in at least 10 characters.");

    save.mutate({
      id: editing?.id,
      payload: {
        name: text("name"),
        category: text("category"),
        description: text("description"),
        provider: text("provider") || undefined,
        location: text("location") || undefined,
        contactEmail: text("contactEmail") || undefined,
        contactPhone: text("contactPhone") || undefined,
        url: text("url") || undefined,
        status: text("status")
      }
    });
  }

  const rows = services.data?.services || [];

  return (
    <section>
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setError("");
            setEditing({ ...EMPTY });
          }}
          className="btn btn-primary focus-ring"
        >
          <Plus size={16} aria-hidden /> New service
        </button>
      </div>

      {services.isLoading ? (
        <ListSkeleton rows={4} />
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => services.refetch()} title="We could not load services" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No services listed yet"
          description="Add the university and student support services your community should know about. Students see this directory under Services."
          action={
            <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn btn-primary focus-ring">
              <Plus size={16} aria-hidden /> New service
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((service, index) => (
            <div
              key={service._id}
              className="stagger-item card flex flex-wrap items-center gap-3 p-4"
              style={{ ["--stagger-index" as string]: index }}
            >
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-primary">{service.category}</span>
                  <span className={`badge ${service.status === "active" ? "badge-success" : "badge"}`}>
                    {service.status}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-bold text-ink">{service.name}</p>
                <p className="truncate text-xs text-muted">
                  {[service.provider, service.location].filter(Boolean).join(" · ") || service.description}
                </p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setEditing({ ...service });
                  }}
                  className="btn btn-secondary btn-sm focus-ring"
                >
                  <Pencil size={13} aria-hidden /> Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${service.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Remove "${service.name}" from the directory?`)) remove.mutate(service.id);
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

      <Pagination meta={services.data?.pagination} onChange={setPage} label="services" />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit service" : "New service"}
        description="Visible to every student as soon as it is active."
        size="lg"
      >
        {editing && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="name">
                  Service name
                </label>
                <input id="name" name="name" defaultValue={editing.name} required className="field" />
              </div>

              <div>
                <label className="field-label" htmlFor="category">
                  Category
                </label>
                <select id="category" name="category" defaultValue={editing.category || "academic"} className="field">
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="status">
                  Status
                </label>
                <select id="status" name="status" defaultValue={editing.status || "active"} className="field">
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={editing.description}
                  required
                  className="field"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="provider">
                  Provider
                </label>
                <input id="provider" name="provider" defaultValue={editing.provider || ""} className="field" />
              </div>

              <div>
                <label className="field-label" htmlFor="location">
                  Location
                </label>
                <input id="location" name="location" defaultValue={editing.location || ""} className="field" />
              </div>

              <div>
                <label className="field-label" htmlFor="contactEmail">
                  Contact email
                </label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={editing.contactEmail || ""}
                  className="field"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="contactPhone">
                  Contact phone
                </label>
                <input id="contactPhone" name="contactPhone" defaultValue={editing.contactPhone || ""} className="field" />
              </div>

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="url">
                  Link
                </label>
                <input id="url" name="url" type="url" defaultValue={editing.url || ""} className="field" />
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
                {save.isPending ? "Saving…" : editing.id ? "Save changes" : "Add service"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary focus-ring">
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
