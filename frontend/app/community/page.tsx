"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, MessagesSquare, Pin, Plus, Reply, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Community feed.
 *
 * Posts and replies are real rows written by real accounts. There is no seeded
 * content: a new deployment shows an empty state until somebody posts.
 */

type Post = {
  _id: string;
  id: string;
  title: string;
  body: string;
  category: "discussion" | "question" | "announcement" | "group" | "event";
  pinned: boolean;
  replyCount: number;
  createdAt: string;
  author?: { id: string; name: string; role: string };
};

// "announcement" is filtered but not offered: the API only accepts it from an
// administrator, so showing it to everyone would invite a 403.
const FILTERS = ["", "discussion", "question", "group", "event", "announcement"] as const;
const POSTABLE = ["discussion", "question", "group", "event"] as const;

function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function PostForm({ onClose }: { onClose: () => void }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api("/community", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["community"] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not publish your post. Please try again.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const body = String(form.get("body") || "").trim();

    if (title.length < 4) return setError("Give your post a title of at least 4 characters.");
    if (body.length < 10) return setError("Write at least 10 characters.");

    create.mutate({
      title,
      body,
      category: String(form.get("category") || "discussion"),
      pinned: user?.role === "admin" ? form.get("pinned") === "on" : undefined
    });
  }

  return (
    <form onSubmit={submit} className="card animate-fade-rise mb-8 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Start a post</h2>
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
            Title
          </label>
          <input id="title" name="title" required className="field" placeholder="Study group for algorithms" />
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Type
          </label>
          <select id="category" name="category" className="field" defaultValue="discussion">
            {(user?.role === "admin" ? [...POSTABLE, "announcement"] : POSTABLE).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="body">
            Message
          </label>
          <textarea id="body" name="body" rows={4} required className="field" placeholder="What would you like to share?" />
        </div>

        {user?.role === "admin" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="pinned" className="h-4 w-4 accent-[rgb(var(--primary))]" />
            Pin to the top and show on dashboards
          </label>
        )}
      </div>

      {error && (
        <p className="alert alert-error mt-4" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <button type="submit" disabled={create.isPending} className="btn btn-primary focus-ring mt-4">
        {create.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
        {create.isPending ? "Publishing…" : "Publish post"}
      </button>
    </form>
  );
}

export default function CommunityPage() {
  const { token } = useAuth();
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);

  const posts = useQuery({
    queryKey: ["community", category],
    queryFn: () => api<{ posts: Post[] }>(`/community${category ? `?category=${category}` : ""}`, { token })
  });

  const rows = posts.data?.posts || [];

  return (
    <Shell>
      <SectionHeader
        title="Community"
        subtitle="Discussions, questions, study groups and events, posted by students on the platform."
        action={
          <button type="button" onClick={() => setShowForm((open) => !open)} className="btn btn-primary focus-ring">
            <Plus size={16} aria-hidden /> New post
          </button>
        }
      />

      {showForm && <PostForm onClose={() => setShowForm(false)} />}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {FILTERS.map((item) => (
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

      {posts.isLoading ? (
        <CardGridSkeleton count={4} className="grid gap-4" />
      ) : posts.isError ? (
        <ErrorState error={posts.error} onRetry={() => posts.refetch()} title="We could not load the community feed" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={category ? `No ${category} posts yet` : "No posts yet"}
          description="Be the first to start a discussion, ask a question, or form a study group."
          action={
            !showForm && (
              <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary focus-ring">
                <Plus size={16} aria-hidden /> New post
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((post, index) => (
            <Link
              key={post._id}
              href={`/community/${post.id}`}
              className="stagger-item card card-interactive focus-ring block p-5"
              style={{ ["--stagger-index" as string]: index }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary">{post.category}</span>
                {post.pinned && (
                  <span className="badge badge-warning">
                    <Pin size={11} aria-hidden /> Pinned
                  </span>
                )}
                <span className="ml-auto text-xs text-muted">{timeAgo(post.createdAt)}</span>
              </div>

              <h2 className="mt-3 text-lg font-bold leading-snug text-ink">{post.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{post.body}</p>

              <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-xs text-muted">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                  {(post.author?.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate font-semibold text-ink">{post.author?.name || "Member"}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <Reply size={13} aria-hidden />
                  {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
