"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Job = {
  _id: string;
  title: string;
  type: string;
  location: string;
  workMode: string;
  description: string;
  status: string;
  company?: { name: string; companyProfile?: { companyName?: string } };
};

export default function OpportunitiesPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const { data } = useQuery({ queryKey: ["jobs"], queryFn: () => api<{ jobs: Job[] }>("/jobs") });

  const createJob = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api("/jobs", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setMessage("Opportunity submitted for admin approval.");
    }
  });

  const apply = useMutation({
    mutationFn: (job: string) =>
      api("/applications", {
        method: "POST",
        token,
        body: JSON.stringify({ job, coverLetter: "I am interested in this opportunity and would like to be considered." })
      }),
    onSuccess: () => setMessage("Application submitted.")
  });

  function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createJob.mutate({
      title: form.get("title"),
      type: form.get("type"),
      location: form.get("location"),
      workMode: form.get("workMode"),
      description: form.get("description")
    });
    event.currentTarget.reset();
  }

  return (
    <Shell>
      <SectionHeader title="Opportunities" subtitle="Jobs and internships for university students, with admin approval before public listing." />
      {message && <p className="mb-4 rounded-md bg-teal-50 px-4 py-3 text-sm text-brand">{message}</p>}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {data?.jobs?.map((job) => (
            <article key={job._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">{job.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {job.company?.companyProfile?.companyName || job.company?.name || "Company"} · {job.location} · {job.workMode}
                  </p>
                </div>
                <span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold uppercase text-accent">{job.type}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{job.description}</p>
              {user?.role === "student" && (
                <button className="focus-ring mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={() => apply.mutate(job._id)}>
                  Apply
                </button>
              )}
            </article>
          ))}
        </div>

        {(user?.role === "company" || user?.role === "admin") && (
          <form onSubmit={submitJob} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Post opportunity</h2>
            <input name="title" placeholder="Title" className="focus-ring mt-4 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <select name="type" className="focus-ring rounded-md border border-slate-300 px-3 py-2">
                <option value="internship">Internship</option>
                <option value="job">Job</option>
              </select>
              <select name="workMode" className="focus-ring rounded-md border border-slate-300 px-3 py-2">
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <input name="location" placeholder="Location" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <textarea name="description" placeholder="Description" rows={5} className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
            <button className="focus-ring mt-3 w-full rounded-md bg-brand px-4 py-2 font-semibold text-white">Submit</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
