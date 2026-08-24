"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Pin, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ErrorState, ListSkeleton } from "@/components/ui/States";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Author = { id: string; name: string; role: string };

type Reply = { _id: string; id: string; body: string; createdAt: string; author?: Author };

type Post = {
  _id: string;
  id: string;
  authorId: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  author?: Author;
  replies?: Reply[];
};

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

function Avatar({ name }: { name?: string }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-muted"
      aria-hidden
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function CommunityThreadPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const thread = useQuery({
    queryKey: ["community-post", id],
    queryFn: () => api<{ post: Post }>(`/community/${id}`, { token }),
    enabled: Boolean(id)
  });

  const post = thread.data?.post;
  const canModerate = Boolean(user && post && (user.role === "admin" || post.authorId === user.id));

  const reply = useMutation({
    mutationFn: (body: string) =>
      api(`/community/${id}/replies`, { method: "POST", token, body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["community-post", id] });
      queryClient.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not post your reply. Please try again.")
  });

  const removePost = useMutation({
    mutationFn: () => api(`/community/${id}`, { method: "DELETE", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
      router.replace("/community");
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not remove this post.")
  });

  const removeReply = useMutation({
    mutationFn: (replyId: string) => api(`/community/${id}/replies/${replyId}`, { method: "DELETE", token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community-post", id] })
  });

  const pin = useMutation({
    mutationFn: (pinned: boolean) =>
      api(`/community/${id}/pin`, { method: "PATCH", token, body: JSON.stringify({ pinned }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-post", id] });
      queryClient.invalidateQueries({ queryKey: ["community"] });
    }
  });

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") || "").trim();
    if (body.length < 2) return setError("Write a reply first.");
    reply.mutate(body, { onSuccess: () => form.reset() });
  }

  return (
    <Shell>
      <Link
        href="/community"
        className="focus-ring mb-5 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> Back to community
      </Link>

      {thread.isLoading ? (
        <ListSkeleton rows={4} />
      ) : thread.isError ? (
        <ErrorState
          error={thread.error}
          onRetry={() => thread.refetch()}
          title="We could not load this discussion"
        />
      ) : !post ? (
        <ErrorState error={new ApiError("This post no longer exists.", 404)} title="Post not found" />
      ) : (
        <>
          <article className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-primary">{post.category}</span>
              {post.pinned && (
                <span className="badge badge-warning">
                  <Pin size={11} aria-hidden /> Pinned
                </span>
              )}
              <span className="ml-auto text-xs text-muted">{timeAgo(post.createdAt)}</span>
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold leading-snug text-ink sm:text-3xl">{post.title}</h1>

            <div className="mt-4 flex items-center gap-2.5">
              <Avatar name={post.author?.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{post.author?.name || "Member"}</p>
                <p className="text-xs capitalize text-muted">{post.author?.role}</p>
              </div>
            </div>

            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-muted">{post.body}</p>

            {(canModerate || user?.role === "admin") && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
                {user?.role === "admin" && (
                  <button
                    type="button"
                    disabled={pin.isPending}
                    onClick={() => pin.mutate(!post.pinned)}
                    className="btn btn-secondary btn-sm focus-ring"
                  >
                    <Pin size={14} aria-hidden /> {post.pinned ? "Unpin" : "Pin to top"}
                  </button>
                )}
                {canModerate && (
                  <button
                    type="button"
                    disabled={removePost.isPending}
                    onClick={() => {
                      if (confirm("Remove this post and all of its replies? This cannot be undone.")) {
                        removePost.mutate();
                      }
                    }}
                    className="btn btn-secondary btn-sm focus-ring text-danger"
                  >
                    <Trash2 size={14} aria-hidden /> Remove post
                  </button>
                )}
              </div>
            )}
          </article>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              {post.replies?.length || 0} {post.replies?.length === 1 ? "reply" : "replies"}
            </h2>

            {post.replies && post.replies.length > 0 ? (
              <div className="space-y-3">
                {post.replies.map((item, index) => (
                  <div
                    key={item._id}
                    className="stagger-item card p-4"
                    style={{ ["--stagger-index" as string]: index }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={item.author?.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{item.author?.name || "Member"}</p>
                        <p className="text-xs text-muted">{timeAgo(item.createdAt)}</p>
                      </div>
                      {(user?.role === "admin" || item.author?.id === user?.id) && (
                        <button
                          type="button"
                          aria-label="Remove reply"
                          onClick={() => {
                            if (confirm("Remove this reply?")) removeReply.mutate(item.id);
                          }}
                          className="focus-ring rounded-lg p-1.5 text-muted hover:bg-dangerSurface hover:text-danger"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{item.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card px-5 py-8 text-center text-sm text-muted">
                No replies yet. Be the first to respond.
              </p>
            )}

            <form onSubmit={submitReply} className="card mt-4 p-4">
              <label className="field-label" htmlFor="body">
                Your reply
              </label>
              <textarea id="body" name="body" rows={3} required className="field" placeholder="Share your thoughts…" />

              {error && (
                <p className="alert alert-error mt-3" role="alert">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" disabled={reply.isPending} className="btn btn-primary focus-ring mt-3">
                {reply.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
                {reply.isPending ? "Posting…" : "Post reply"}
              </button>
            </form>
          </section>
        </>
      )}
    </Shell>
  );
}
