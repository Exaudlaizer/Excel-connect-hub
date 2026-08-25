"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ImageOff, Loader2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { PageMeta, Pagination } from "@/components/ui/Pagination";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Advertisement management.
 *
 * An administrator can create a listing outright, edit any field of an existing
 * one including its artwork, approve or reject what advertisers submit, and
 * remove a listing entirely. Anything created here is published immediately —
 * the review queue exists to check other people's submissions, not the
 * administrator's own.
 */

type Ad = {
  _id: string;
  id: string;
  title: string;
  businessName?: string;
  category: string;
  description: string;
  price?: string | number | null;
  contact: string;
  location?: string;
  imageUrl?: string;
  logoUrl?: string;
  linkUrl?: string;
  status: "pending" | "approved" | "rejected" | "expired";
  owner?: { id: string; name: string };
};

const CATEGORIES = ["technology", "food", "fashion", "events", "services", "housing", "other"] as const;

const STATUS_FILTERS = ["", "pending", "approved", "rejected", "expired"] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
  expired: "badge"
};

const EMPTY: Partial<Ad> = {
  title: "",
  businessName: "",
  category: "technology",
  description: "",
  contact: "",
  location: "",
  imageUrl: "",
  logoUrl: "",
  linkUrl: ""
};

export function AdminAds() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Ad> | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState("");
  const [logo, setLogo] = useState("");

  const ads = useQuery({
    queryKey: ["admin-ads", status, page],
    queryFn: () =>
      api<{ ads: Ad[]; pagination: PageMeta }>(`/ads?page=${page}${status ? `&status=${status}` : ""}`, { token })
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    queryClient.invalidateQueries({ queryKey: ["ads"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  }

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id
        ? api(`/ads/${id}`, { method: "PATCH", token, body: JSON.stringify(payload) })
        : api("/ads", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not save this advertisement.")
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api(`/ads/${id}/approval`, { method: "PATCH", token, body: JSON.stringify({ status: next }) }),
    onSuccess: refresh
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/ads/${id}`, { method: "DELETE", token }),
    onSuccess: refresh
  });

  function openEditor(ad?: Ad) {
    setError("");
    setImage(ad?.imageUrl || "");
    setLogo(ad?.logoUrl || "");
    setEditing(ad ? { ...ad } : { ...EMPTY });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();

    if (text("title").length < 3) return setError("Enter a title of at least 3 characters.");
    if (text("description").length < 10) return setError("Write a description of at least 10 characters.");
    if (!text("contact")) return setError("Enter a contact for this business.");

    save.mutate({
      id: editing?.id,
      payload: {
        title: text("title"),
        businessName: text("businessName") || undefined,
        category: text("category"),
        description: text("description"),
        price: text("price") ? Number(text("price")) : undefined,
        contact: text("contact"),
        location: text("location") || undefined,
        imageUrl: image || undefined,
        logoUrl: logo || undefined,
        linkUrl: text("linkUrl") || undefined
      }
    });
  }

  const rows = ads.data?.ads || [];

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item || "all"}
              type="button"
              onClick={() => {
                setStatus(item);
                setPage(1);
              }}
              aria-pressed={status === item}
              className={`focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                status === item ? "bg-brand text-night" : "bg-secondary text-muted hover:text-ink"
              }`}
            >
              {item || "All"}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => openEditor()} className="btn btn-primary focus-ring">
          <Plus size={16} aria-hidden /> New advertisement
        </button>
      </div>

      {ads.isLoading ? (
        <CardGridSkeleton count={4} className="grid gap-4 md:grid-cols-2" />
      ) : ads.isError ? (
        <ErrorState error={ads.error} onRetry={() => ads.refetch()} title="We could not load advertisements" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={status ? `No ${status} advertisements` : "No advertisements yet"}
          description="Create one here, or wait for a business to submit theirs for review."
          action={
            <button type="button" onClick={() => openEditor()} className="btn btn-primary focus-ring">
              <Plus size={16} aria-hidden /> New advertisement
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((ad, index) => (
            <article
              key={ad._id}
              className="stagger-item card flex gap-4 p-4"
              style={{ ["--stagger-index" as string]: index }}
            >
              {ad.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.imageUrl}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-lg border border-line object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-dashed border-line text-muted"
                  aria-hidden
                >
                  <ImageOff size={18} />
                </span>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className={`badge ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>
                  <span className="badge">{ad.category}</span>
                </div>

                <h3 className="mt-2 truncate text-sm font-bold text-ink">{ad.title}</h3>
                <p className="truncate text-xs text-muted">
                  {ad.businessName || ad.owner?.name || "Unnamed business"}
                </p>
                <p className="mt-1 line-clamp-2 flex-1 text-xs leading-5 text-muted">{ad.description}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditor(ad)}
                    className="btn btn-secondary btn-sm focus-ring"
                  >
                    <Pencil size={13} aria-hidden /> Edit
                  </button>

                  {ad.status !== "approved" && (
                    <button
                      type="button"
                      disabled={setStatusMutation.isPending}
                      onClick={() => setStatusMutation.mutate({ id: ad.id, next: "approved" })}
                      className="btn btn-primary btn-sm focus-ring"
                    >
                      <Check size={13} aria-hidden /> Approve
                    </button>
                  )}

                  {ad.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={setStatusMutation.isPending}
                      onClick={() => {
                        if (confirm(`Reject "${ad.title}"? The advertiser will need to resubmit.`)) {
                          setStatusMutation.mutate({ id: ad.id, next: "rejected" });
                        }
                      }}
                      className="btn btn-secondary btn-sm focus-ring"
                    >
                      <X size={13} aria-hidden /> Reject
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={`Delete ${ad.title}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(`Permanently delete "${ad.title}"? This cannot be undone.`)) remove.mutate(ad.id);
                    }}
                    className="btn btn-secondary btn-sm focus-ring text-danger"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination meta={ads.data?.pagination} onChange={setPage} label="advertisements" />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit advertisement" : "New advertisement"}
        description={
          editing?.id
            ? "Changes are published immediately."
            : "Created by an administrator, so it is published without review."
        }
        size="lg"
      >
        {editing && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload label="Advertisement image" value={image} onChange={setImage} aspect="aspect-[16/9]" />
              <ImageUpload label="Business logo" value={logo} onChange={setLogo} aspect="aspect-square" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="title">
                  Offer title
                </label>
                <input id="title" name="title" defaultValue={editing.title} required className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="businessName">
                  Business name
                </label>
                <input id="businessName" name="businessName" defaultValue={editing.businessName || ""} className="field" />
              </div>
            </div>

            <div>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="category">
                  Category
                </label>
                <select id="category" name="category" defaultValue={editing.category || "technology"} className="field">
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="price">
                  Price (TZS)
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min={0}
                  defaultValue={editing.price ? Number(editing.price) : ""}
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="location">
                  Location
                </label>
                <input id="location" name="location" defaultValue={editing.location || ""} className="field" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="contact">
                  Contact
                </label>
                <input id="contact" name="contact" defaultValue={editing.contact} required className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="linkUrl">
                  Destination link
                </label>
                <input id="linkUrl" name="linkUrl" type="url" defaultValue={editing.linkUrl || ""} className="field" />
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
                {save.isPending ? "Saving…" : editing.id ? "Save changes" : "Publish advertisement"}
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
