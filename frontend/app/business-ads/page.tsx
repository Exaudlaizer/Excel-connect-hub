"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Megaphone,
  Phone,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Business advertisement catalogue.
 *
 * Every card is a row from the `ads` table. Nothing is hard-coded: when the
 * table is empty the page says so rather than showing sample businesses.
 * Submissions are held at `pending` until an administrator approves them, which
 * is why an owner sees a status badge on their own listings and nobody else
 * sees them at all.
 */

type Ad = {
  _id: string;
  id: string;
  ownerId: string;
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
  createdAt?: string;
  owner?: { id: string; name: string; role: string };
};

const CATEGORIES = ["technology", "food", "fashion", "events", "services", "housing", "other"] as const;

const STATUS_BADGE: Record<Ad["status"], string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
  expired: "badge"
};

function formatPrice(price: Ad["price"]) {
  const value = Number(price);
  if (!price || Number.isNaN(value) || value <= 0) return "Contact for price";
  return `TZS ${value.toLocaleString()}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/* -------------------------------------------------------------------------
   Catalogue card
   ------------------------------------------------------------------------- */

function AdCard({ ad, index, isOwner, onDelete }: { ad: Ad; index: number; isOwner: boolean; onDelete?: () => void }) {
  const business = ad.businessName || ad.owner?.name || "Local business";

  return (
    <article
      className="stagger-item card card-interactive flex flex-col overflow-hidden"
      style={{ ["--stagger-index" as string]: index }}
    >
      {/* Advertisement image. Only rendered when the advertiser supplied one —
          no stock photography stands in for a missing image. */}
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt=""
          className="h-40 w-full border-b border-line object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="badge badge-primary">{ad.category}</span>
          {isOwner && <span className={`badge ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>}
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          {ad.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted"
              aria-hidden
            >
              {initials(business)}
            </span>
          )}
          <p className="min-w-0 truncate text-xs font-bold tracking-wide text-muted">{business}</p>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-snug text-ink">{ad.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted">{ad.description}</p>

        <div className="mt-4 space-y-1.5 text-sm">
          <p className="font-bold text-ink">{formatPrice(ad.price)}</p>
          <p className="flex items-center gap-1.5 text-muted">
            <Phone size={13} className="shrink-0" aria-hidden />
            <span className="truncate">{ad.contact}</span>
          </p>
          {ad.location && (
            <p className="flex items-center gap-1.5 text-muted">
              <MapPin size={13} className="shrink-0" aria-hidden />
              <span className="truncate">{ad.location}</span>
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2 border-t border-line pt-4">
          {ad.linkUrl ? (
            <a
              href={ad.linkUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-primary btn-sm focus-ring flex-1"
            >
              View Offer <ExternalLink size={13} aria-hidden />
            </a>
          ) : (
            <a href={`tel:${ad.contact.replace(/\s/g, "")}`} className="btn btn-primary btn-sm focus-ring flex-1">
              Contact business
            </a>
          )}
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remove ${ad.title}`}
              className="btn btn-secondary btn-sm focus-ring text-danger"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------
   Submission form
   ------------------------------------------------------------------------- */

function AdForm({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api("/ads", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      queryClient.invalidateQueries({ queryKey: ["my-ads"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not submit your advertisement. Please try again.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const text = (key: string) => String(form.get(key) || "").trim();

    if (text("description").length < 10) {
      setError("Describe your offer in at least 10 characters.");
      return;
    }

    create.mutate({
      title: text("title"),
      businessName: text("businessName") || undefined,
      category: text("category"),
      description: text("description"),
      price: text("price") ? Number(text("price")) : undefined,
      contact: text("contact"),
      location: text("location") || undefined,
      imageUrl: text("imageUrl") || undefined,
      logoUrl: text("logoUrl") || undefined,
      linkUrl: text("linkUrl") || undefined
    });
  }

  if (done) {
    return (
      <div className="card animate-fade-rise p-6 text-center" role="status">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-successSurface text-success">
          <CheckCircle2 size={22} aria-hidden />
        </span>
        <p className="mt-4 text-base font-bold text-ink">Submitted for review</p>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          An administrator reviews every advertisement before it reaches students. You can see its status under “Your
          advertisements”.
        </p>
        <button type="button" onClick={onClose} className="btn btn-secondary focus-ring mt-5">
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card animate-fade-rise p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Advertise to students</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Reviewed before it appears in the catalogue.</p>
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
          <label className="field-label" htmlFor="title">
            Offer title
          </label>
          <input id="title" name="title" required minLength={3} placeholder="Student Laptop Offer" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="businessName">
            Business name
          </label>
          <input id="businessName" name="businessName" placeholder="Kilimanjaro Computers" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" className="field" defaultValue="technology">
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
          <textarea
            id="description"
            name="description"
            rows={3}
            required
            minLength={10}
            placeholder="Affordable laptops for students, with a one-year warranty."
            className="field"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="price">
              Price in TZS
            </label>
            <input id="price" name="price" type="number" min={0} placeholder="Leave blank if on request" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="location">
              Location
            </label>
            <input id="location" name="location" placeholder="Dar es Salaam" className="field" />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="contact">
            Contact
          </label>
          <input id="contact" name="contact" required placeholder="+255 700 000 000" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="logoUrl">
            Logo link <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="logoUrl" name="logoUrl" type="url" placeholder="https://…" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="imageUrl">
            Image link <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="imageUrl" name="imageUrl" type="url" placeholder="https://…" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="linkUrl">
            Destination link <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="linkUrl" name="linkUrl" type="url" placeholder="https://…" className="field" />
        </div>
      </div>

      {error && (
        <p className="alert alert-error mt-4" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <button type="submit" disabled={create.isPending} className="btn btn-primary focus-ring mt-4 w-full">
        {create.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
        {create.isPending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */

export default function BusinessAdsPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);

  const ads = useQuery({
    queryKey: ["ads", category],
    queryFn: () => api<{ ads: Ad[] }>(`/ads${category ? `?category=${category}` : ""}`, { token })
  });

  const myAds = useQuery({
    queryKey: ["my-ads"],
    queryFn: () => api<{ ads: Ad[] }>("/ads/mine", { token }),
    enabled: Boolean(token)
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/ads/${id}`, { method: "DELETE", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      queryClient.invalidateQueries({ queryKey: ["my-ads"] });
    }
  });

  // The list endpoint returns an owner's own pending rows too. The public
  // catalogue shows only approved ones; pending rows belong in "Your
  // advertisements" where their status is explained.
  const catalogue = (ads.data?.ads || []).filter((ad) => ad.status === "approved");
  const mine = myAds.data?.ads || [];

  return (
    <Shell>
      <SectionHeader
        title="Business Ads"
        subtitle="Businesses can reach students with relevant products, services, events and offers. Every listing is reviewed before it appears here."
        action={
          <button type="button" onClick={() => setShowForm((open) => !open)} className="btn btn-primary focus-ring">
            <Plus size={16} aria-hidden /> Post an advertisement
          </button>
        }
      />

      {showForm && (
        <div className="mb-8 max-w-xl">
          <AdForm onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* Your own submissions, including anything still awaiting review. */}
      {mine.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Your advertisements</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((ad, index) => (
              <AdCard
                key={ad._id}
                ad={ad}
                index={index}
                isOwner
                onDelete={() => {
                  if (confirm(`Remove "${ad.title}"? This cannot be undone.`)) remove.mutate(ad.id);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          {mine.length > 0 ? "All advertisements" : "Advertisements"}
        </h2>
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

        {ads.isLoading ? (
          <CardGridSkeleton count={6} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" />
        ) : ads.isError ? (
          <ErrorState
            error={ads.error}
            onRetry={() => ads.refetch()}
            title="We could not load the advertisements"
          />
        ) : catalogue.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={category ? `No advertisements in ${category} yet` : "No advertisements yet"}
            description={
              category
                ? "Try another category, or check back once more businesses have published in this one."
                : "Approved business offers will appear here. If you run a business, you can submit one for review."
            }
            action={
              !showForm && (
                <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary focus-ring">
                  <Plus size={16} aria-hidden /> Post an advertisement
                </button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalogue.map((ad, index) => (
              <AdCard key={ad._id} ad={ad} index={index} isOwner={ad.ownerId === user?.id} />
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
