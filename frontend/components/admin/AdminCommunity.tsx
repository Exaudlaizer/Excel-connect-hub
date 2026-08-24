"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessagesSquare, Pin, PinOff, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Post = {
  _id: string;
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  replyCount: number;
  createdAt: string;
  author?: { name: string; role: string };
};

const CATEGORIES = ["", "discussion", "question", "announcement", "group", "event"] as const;

/**
 * Community moderation.
 *
 * Administrators can pin a post so it reaches every dashboard as an
 * announcement, and remove anything that does not belong. Editing another
 * member's words is deliberately not offered: a moderator removes or promotes a
 * post, they do not rewrite what somebody said.
 */
export function AdminCommunity() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");

  const posts = useQuery({
    queryKey: ["admin-community", category],
    queryFn: () => api<{ posts: Post[] }>(`/community${category ? `?category=${category}` : ""}`, { token })
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-community"] });
    queryClient.invalidateQueries({ queryKey: ["community"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-posts"] });
  }

  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api(`/community/${id}/pin`, { method: "PATCH", token, body: JSON.stringify({ pinned }) }),
    onSuccess: refresh
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/community/${id}`, { method: "DELETE", token }),
    onSuccess: refresh
  });

  const rows = posts.data?.posts || [];

  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {CATEGORIES.map((item) => (
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
        <ListSkeleton rows={4} />
      ) : posts.isError ? (
        <ErrorState error={posts.error} onRetry={() => posts.refetch()} title="We could not load community posts" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={category ? `No ${category} posts` : "No community posts yet"}
          description="Posts written by members appear here for moderation."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((post, index) => (
            <div
              key={post._id}
              className="stagger-item card flex flex-wrap items-center gap-3 p-4"
              style={{ ["--stagger-index" as string]: index }}
            >
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-primary">{post.category}</span>
                  {post.pinned && (
                    <span className="badge badge-warning">
                      <Pin size={10} aria-hidden /> Pinned
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-bold text-ink">{post.title}</p>
                <p className="truncate text-xs text-muted">
                  {post.author?.name || "Member"} · {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Link href={`/community/${post.id}`} className="btn btn-secondary btn-sm focus-ring">
                  <ExternalLink size={13} aria-hidden /> Open
                </Link>
                <button
                  type="button"
                  disabled={pin.isPending}
                  onClick={() => pin.mutate({ id: post.id, pinned: !post.pinned })}
                  className={`btn btn-sm focus-ring ${post.pinned ? "btn-secondary" : "btn-primary"}`}
                >
                  {post.pinned ? <PinOff size={13} aria-hidden /> : <Pin size={13} aria-hidden />}
                  {post.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${post.title}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Delete "${post.title}" and all of its replies? This cannot be undone.`)) {
                      remove.mutate(post.id);
                    }
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
    </section>
  );
}
