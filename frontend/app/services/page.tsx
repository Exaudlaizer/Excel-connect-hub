"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, LifeBuoy, Loader2, Mail, MapPin, Phone, Plus, Trash2, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * University and student support directory.
 *
 * Read-mostly: students browse it, administrators curate it. The list starts
 * empty on a new deployment and says so, rather than shipping invented services
 * for a university the platform knows nothing about.
 */

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

function ServiceForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api("/services", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not add this service. Please try again.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();

    if (text("name").length < 3) return setError("Enter the service name.");
    if (text("description").length < 10) return setError("Describe the service in at least 10 characters.");

    create.mutate({
      name: text("name"),
      category: text("category"),
      description: text("description"),
      provider: text("provider") || undefined,
      location: text("location") || undefined,
      contactEmail: text("contactEmail") || undefined,
      contactPhone: text("contactPhone") || undefined,
      url: text("url") || undefined
    });
  }

  return (
    <form onSubmit={submit} className="card animate-fade-rise mb-8 max-w-xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Add a service</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Visible to every student straight away.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="focus-ring rounded-lg p-1.5 text-muted hover:bg-secondary"
        >
          <X size={17} aria-hidden />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="field-label" htmlFor="name">
            Service name
          </label>
          <input id="name" name="name" required className="field" placeholder="Academic Writing Centre" />
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" className="field" defaultValue="academic">
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="description">
            Description
          </label>
          <textarea id="description" name="description" rows={3} required className="field" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="provider">
              Provider
            </label>
            <input id="provider" name="provider" className="field" placeholder="Student Affairs" />
          </div>
          <div>
            <label className="field-label" htmlFor="location">
              Location
            </label>
            <input id="location" name="location" className="field" placeholder="Main campus, Block C" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="contactEmail">
              Contact email
            </label>
            <input id="contactEmail" name="contactEmail" type="email" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="contactPhone">
              Contact phone
            </label>
            <input id="contactPhone" name="contactPhone" className="field" />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="url">
            Link <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="url" name="url" type="url" className="field" placeholder="https://…" />
        </div>
      </div>

      {error && (
        <p className="alert alert-error mt-4" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <button type="submit" disabled={create.isPending} className="btn btn-primary focus-ring mt-4">
        {create.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
        {create.isPending ? "Adding…" : "Add service"}
      </button>
    </form>
  );
}

export default function ServicesPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);

  const isAdmin = user?.role === "admin";

  const services = useQuery({
    queryKey: ["services", category],
    queryFn: () => api<{ services: Service[] }>(`/services${category ? `?category=${category}` : ""}`, { token })
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/services/${id}`, { method: "DELETE", token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] })
  });

  const rows = services.data?.services || [];

  return (
    <Shell>
      <SectionHeader
        title="University Services"
        subtitle="Academic, career, wellbeing and financial support available to students, curated by the platform administrators."
        action={
          isAdmin && (
            <button type="button" onClick={() => setShowForm((open) => !open)} className="btn btn-primary focus-ring">
              <Plus size={16} aria-hidden /> Add service
            </button>
          )
        }
      />

      {showForm && isAdmin && <ServiceForm onClose={() => setShowForm(false)} />}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {["", ...CATEGORIES].map((item) => (
          <button
            key={item || "all"}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
            className={`focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
              category === item ? "bg-brand text-night" : "bg-secondary text-muted hover:text-ink"
            }`}
          >
            {item || "All"}
          </button>
        ))}
      </div>

      {services.isLoading ? (
        <CardGridSkeleton count={4} className="grid gap-4 md:grid-cols-2" />
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => services.refetch()} title="We could not load services" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={category ? `No ${category} services listed yet` : "No services listed yet"}
          description={
            isAdmin
              ? "Add the university and student support services your community should know about."
              : "Support services will appear here once an administrator adds them."
          }
          action={
            isAdmin &&
            !showForm && (
              <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary focus-ring">
                <Plus size={16} aria-hidden /> Add service
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((service, index) => (
            <article
              key={service._id}
              className="stagger-item card card-interactive flex flex-col p-5"
              style={{ ["--stagger-index" as string]: index }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="badge badge-primary">{service.category}</span>
                {isAdmin && service.status === "archived" && <span className="badge">archived</span>}
              </div>

              <h2 className="mt-3 text-lg font-bold leading-snug text-ink">{service.name}</h2>
              {service.provider && <p className="mt-1 text-sm font-semibold text-muted">{service.provider}</p>}

              <p className="mt-3 flex-1 text-sm leading-6 text-muted">{service.description}</p>

              <div className="mt-4 space-y-1.5 text-sm text-muted">
                {service.location && (
                  <p className="flex items-center gap-1.5">
                    <MapPin size={13} className="shrink-0" aria-hidden />
                    <span className="truncate">{service.location}</span>
                  </p>
                )}
                {service.contactEmail && (
                  <p className="flex items-center gap-1.5">
                    <Mail size={13} className="shrink-0" aria-hidden />
                    <a href={`mailto:${service.contactEmail}`} className="focus-ring truncate rounded hover:text-brand">
                      {service.contactEmail}
                    </a>
                  </p>
                )}
                {service.contactPhone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={13} className="shrink-0" aria-hidden />
                    <span className="truncate">{service.contactPhone}</span>
                  </p>
                )}
              </div>

              {(service.url || isAdmin) && (
                <div className="mt-5 flex gap-2 border-t border-line pt-4">
                  {service.url && (
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm focus-ring flex-1"
                    >
                      Open service <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label={`Remove ${service.name}`}
                      onClick={() => {
                        if (confirm(`Remove "${service.name}" from the directory?`)) remove.mutate(service.id);
                      }}
                      className="btn btn-secondary btn-sm focus-ring text-danger"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
