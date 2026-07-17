"use client";

import { FormEvent, useMemo, useState } from "react";
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

type Application = {
  _id: string;
  status: string;
  job?: { _id: string; title: string; company?: { name: string; companyProfile?: { companyName?: string } } };
};

const postingStatusStyles: Record<string, string> = {
  pending: "bg-accent/10 text-accent",
  approved: "bg-brand/10 text-brand",
  rejected: "bg-red-50 text-red-700",
  closed: "bg-slate-100 text-slate-600"
};

const applicationStatusStyles: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-600",
  reviewing: "bg-blue-50 text-blue-700",
  shortlisted: "bg-accent/10 text-accent",
  hired: "bg-brand/10 text-brand",
  rejected: "bg-red-50 text-red-700"
};

function StatusBadge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function OpportunitiesPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const isEmployer = user?.role === "company" || user?.role === "admin";

  const { data, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => api<{ jobs: Job[] }>("/jobs") });

  const myApplications = useQuery({
    queryKey: ["my-applications", token],
    queryFn: () => api<{ applications: Application[] }>("/applications/mine", { token }),
    enabled: user?.role === "student" && Boolean(token)
  });

  const myJobs = useQuery({
    queryKey: ["my-jobs", token],
    queryFn: () => api<{ jobs: Job[] }>("/jobs/mine", { token }),
    enabled: isEmployer && Boolean(token)
  });

  const appliedStatusByJob = useMemo(() => {
    const map = new Map<string, string>();
    for (const application of myApplications.data?.applications || []) {
      if (application.job?._id) map.set(application.job._id, application.status);
    }
    return map;
  }, [myApplications.data]);

  const createJob = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api("/jobs", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      setMessage("Opportunity submitted for admin approval.");
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Could not submit opportunity.")
  });

  const apply = useMutation({
    mutationFn: (job: string) =>
      api("/applications", {
        method: "POST",
        token,
        body: JSON.stringify({ job, coverLetter: "I am interested in this opportunity and would like to be considered." })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      setMessage("Application submitted.");
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Could not submit application.")
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
      <SectionHeader title="Opportunities" subtitle="Jobs and internships for youth, with admin approval before public listing." />
      {message && <p className="mb-4 rounded-md bg-brand/10 px-4 py-3 text-sm text-brand">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {isEmployer && (
            <section className="rounded-lg border border-line bg-card p-5 shadow-sm">
              <h2 className="font-bold text-ink">My postings</h2>
              <p className="mt-1 text-sm text-muted">Your submissions and their approval status. Only approved listings are public.</p>
              <div className="mt-4 space-y-2">
                {myJobs.isLoading && <p className="text-sm text-muted">Loading your postings…</p>}
                {!myJobs.isLoading && (myJobs.data?.jobs?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted">You have not posted any opportunities yet.</p>
                )}
                {myJobs.data?.jobs?.map((job) => (
                  <div key={job._id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{job.title}</p>
                      <p className="text-xs text-muted">{job.type} · {job.location}</p>
                    </div>
                    <StatusBadge status={job.status} styles={postingStatusStyles} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open opportunities</h2>
            {isLoading && <p className="text-sm text-muted">Loading opportunities…</p>}
            {!isLoading && (data?.jobs?.length ?? 0) === 0 && (
              <p className="rounded-md border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
                No approved opportunities are live yet. Check back soon.
              </p>
            )}
            {data?.jobs?.map((job) => {
              const appliedStatus = appliedStatusByJob.get(job._id);
              return (
                <article key={job._id} className="rounded-lg border border-line bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">{job.title}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {job.company?.companyProfile?.companyName || job.company?.name || "Company"} · {job.location} · {job.workMode}
                      </p>
                    </div>
                    <span className="rounded bg-accent/10 px-2 py-1 text-xs font-semibold uppercase text-accent">{job.type}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{job.description}</p>
                  {user?.role === "student" &&
                    (appliedStatus ? (
                      <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted">
                        Application status: <StatusBadge status={appliedStatus} styles={applicationStatusStyles} />
                      </p>
                    ) : (
                      <button
                        className="focus-ring mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-night disabled:opacity-60"
                        disabled={apply.isPending}
                        onClick={() => apply.mutate(job._id)}
                      >
                        {apply.isPending ? "Applying…" : "Apply"}
                      </button>
                    ))}
                </article>
              );
            })}
          </div>
        </div>

        {isEmployer && (
          <form onSubmit={submitJob} className="h-fit rounded-lg border border-line bg-card p-5 shadow-sm">
            <h2 className="font-bold text-ink">Post opportunity</h2>
            <input name="title" placeholder="Title" className="focus-ring mt-4 w-full rounded-md border border-line px-3 py-2" required />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <select name="type" className="focus-ring rounded-md border border-line px-3 py-2">
                <option value="internship">Internship</option>
                <option value="job">Job</option>
              </select>
              <select name="workMode" className="focus-ring rounded-md border border-line px-3 py-2">
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <input name="location" placeholder="Location" className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2" required />
            <textarea name="description" placeholder="Description (min 20 characters)" rows={5} className="focus-ring mt-3 w-full rounded-md border border-line px-3 py-2" required />
            <button disabled={createJob.isPending} className="focus-ring mt-3 w-full rounded-md bg-brand px-4 py-2 font-semibold text-night disabled:opacity-60">
              {createJob.isPending ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}

        {user?.role === "student" && (
          <aside className="h-fit rounded-lg border border-line bg-card p-5 shadow-sm">
            <h2 className="font-bold text-ink">My applications</h2>
            <div className="mt-4 space-y-3">
              {myApplications.isLoading && <p className="text-sm text-muted">Loading your applications…</p>}
              {!myApplications.isLoading && (myApplications.data?.applications?.length ?? 0) === 0 && (
                <p className="text-sm text-muted">You have not applied to any opportunities yet.</p>
              )}
              {myApplications.data?.applications?.map((application) => (
                <div key={application._id} className="rounded-md border border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold text-ink">{application.job?.title || "Opportunity"}</p>
                    <StatusBadge status={application.status} styles={applicationStatusStyles} />
                  </div>
                  <p className="text-xs text-muted">
                    {application.job?.company?.companyProfile?.companyName || application.job?.company?.name || "Company"}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );
}
