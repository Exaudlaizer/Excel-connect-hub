"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Presentation } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Course = {
  _id: string;
  title: string;
  category: string;
  description: string;
  duration?: string;
  price?: number;
  deliveryMode: string;
  status: string;
  provider?: { id: string; name: string; mentorProfile?: { expertise?: string } };
};

// Mentors own their courses; the platform lists them. A mentor sees their own
// drafts alongside approved ones, which is why status is surfaced on the card.
export default function LearningPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["courses", token],
    queryFn: () => api<{ courses: Course[] }>("/courses", { token })
  });

  const createCourse = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api("/courses", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      setError("");
      setMessage("Course submitted. It appears publicly once an admin approves it.");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Could not submit the course")
  });

  const enroll = useMutation({
    mutationFn: (id: string) => api(`/courses/${id}/enroll`, { method: "POST", token }),
    onSuccess: () => {
      setError("");
      setMessage("Enrollment recorded. The mentor will be in touch.");
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Could not enroll")
  });

  const canPublish = user?.role === "mentor" || user?.role === "admin";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createCourse.mutate({
      title: form.get("title"),
      category: form.get("category"),
      description: form.get("description"),
      duration: form.get("duration"),
      price: Number(form.get("price") || 0),
      deliveryMode: form.get("deliveryMode")
    });
    event.currentTarget.reset();
  }

  const courses = data?.courses ?? [];

  return (
    <Shell>
      <SectionHeader
        title="Learning Hub"
        subtitle="Courses offered by independent mentors across Tanzania. Browse what mentors are teaching, or sign up as a mentor to offer your own."
      />

      {message && <p className="mb-4 rounded-md bg-brand/10 px-4 py-3 text-sm text-brand">{message}</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {isLoading && <p className="text-sm text-muted">Loading courses...</p>}

          {!isLoading && courses.length === 0 && (
            <div className="rounded-lg border border-dashed border-line bg-card p-10 text-center">
              <Presentation className="mx-auto mb-3 text-muted" size={28} />
              <p className="font-semibold text-ink">No courses yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {canPublish
                  ? "Be the first mentor to offer a course here."
                  : "Mentors haven't published any courses yet. Check back soon."}
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course._id} className="flex flex-col rounded-lg border border-line bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded bg-brand/10 px-2 py-1 text-xs font-semibold uppercase text-brand">
                    {course.category}
                  </span>
                  {course.status !== "approved" && (
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-500">
                      {course.status}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-bold text-ink">{course.title}</h2>

                {course.provider?.name && (
                  <p className="mt-1 text-sm font-medium text-muted">
                    by {course.provider.name}
                    {course.provider.mentorProfile?.expertise ? ` · ${course.provider.mentorProfile.expertise}` : ""}
                  </p>
                )}

                <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">{course.description}</p>

                <p className="mt-3 text-sm text-muted">
                  {course.duration || "Flexible"} · {course.deliveryMode} ·{" "}
                  {course.price ? `TZS ${course.price.toLocaleString()}` : "Free"}
                </p>

                {user?.role === "student" && course.status === "approved" && (
                  <button
                    onClick={() => enroll.mutate(course._id)}
                    disabled={enroll.isPending}
                    className="focus-ring mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-brandDark disabled:opacity-60"
                  >
                    {enroll.isPending ? "Enrolling..." : "Enroll"}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>

        {canPublish && (
          <form onSubmit={submit} className="h-fit rounded-lg border border-line bg-card p-5 shadow-sm">
            <h2 className="font-bold text-ink">Offer a course</h2>
            <p className="mt-1 text-xs text-muted">Your course is reviewed by an admin before it goes live.</p>
            <input name="title" placeholder="Title" className="focus-ring mt-4 w-full rounded-md border border-line px-3 py-2" required />
            <input name="category" placeholder="Category" className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2" required />
            <textarea
              name="description"
              placeholder="Description (min 20 characters)"
              rows={4}
              className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2"
              required
            />
            <input name="duration" placeholder="Duration" className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2" />
            <input name="price" type="number" min={0} placeholder="Price in TZS (0 for free)" className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2" />
            <select name="deliveryMode" className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2">
              <option value="online">Online</option>
              <option value="in-person">In person</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <button
              disabled={createCourse.isPending}
              className="focus-ring mt-3 w-full rounded-md bg-brand px-4 py-2 font-semibold text-night transition-colors hover:bg-brandDark disabled:opacity-60"
            >
              {createCourse.isPending ? "Submitting..." : "Submit for approval"}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}
