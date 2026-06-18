"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Course = { _id: string; title: string; category: string; description: string; duration?: string; price?: number; deliveryMode: string };

export default function LearningPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const { data } = useQuery({ queryKey: ["courses"], queryFn: () => api<{ courses: Course[] }>("/courses") });
  const createCourse = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api("/courses", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] })
  });
  const enroll = useMutation({
    mutationFn: (id: string) => api(`/courses/${id}/enroll`, { method: "POST", token }),
    onSuccess: () => setMessage("Enrollment recorded.")
  });

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

  return (
    <Shell>
      <SectionHeader title="Learning Hub" subtitle="Short courses for digital skills, career readiness, entrepreneurship, and workplace preparation." />
      {message && <p className="mb-4 rounded-md bg-teal-50 px-4 py-3 text-sm text-brand">{message}</p>}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {data?.courses?.map((course) => (
            <article key={course._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <span className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold uppercase text-brand">{course.category}</span>
              <h2 className="mt-3 text-lg font-bold text-ink">{course.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{course.description}</p>
              <p className="mt-3 text-sm text-muted">{course.duration || "Flexible"} · {course.deliveryMode} · TZS {(course.price || 0).toLocaleString()}</p>
              {user?.role === "student" && (
                <button onClick={() => enroll.mutate(course._id)} className="focus-ring mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Enroll</button>
              )}
            </article>
          ))}
        </div>
        {(user?.role === "company" || user?.role === "admin") && (
          <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Add course</h2>
            <input name="title" placeholder="Title" className="focus-ring mt-4 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <input name="category" placeholder="Category" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <textarea name="description" placeholder="Description" rows={4} className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <input name="duration" placeholder="Duration" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="price" type="number" placeholder="Price in TZS" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <select name="deliveryMode" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="online">Online</option>
              <option value="in-person">In person</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <button className="focus-ring mt-3 w-full rounded-md bg-brand px-4 py-2 font-semibold text-white">Submit for approval</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
