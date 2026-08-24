"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ApplicantStatus = "submitted" | "reviewing" | "shortlisted" | "rejected" | "hired";

type StudentProfile = {
  university?: string;
  program?: string;
  skills?: string[];
};

type Applicant = {
  _id: string;
  coverLetter: string;
  cvUrl?: string;
  status: ApplicantStatus;
  createdAt?: string;
  student?: { name: string; email: string; studentProfile?: StudentProfile };
  job?: { _id: string; title: string; type: string };
};

const statusFlow: ApplicantStatus[] = ["submitted", "reviewing", "shortlisted", "hired", "rejected"];

const statusStyles: Record<ApplicantStatus, string> = {
  submitted: "bg-secondary text-muted",
  reviewing: "bg-infoSurface text-info",
  shortlisted: "bg-accent/10 text-accent",
  hired: "bg-brand/10 text-brand",
  rejected: "bg-dangerSurface text-danger"
};

export default function ApplicantsPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["applicants"],
    queryFn: () => api<{ applications: Applicant[] }>("/applications/applicants", { token }),
    enabled: (user?.role === "company" || user?.role === "admin") && Boolean(token)
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicantStatus }) =>
      api(`/applications/${id}/status`, { method: "PATCH", token, body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applicants"] })
  });

  const groups = useMemo(() => {
    const byJob = new Map<string, { title: string; type: string; applicants: Applicant[] }>();
    for (const application of data?.applications || []) {
      const jobId = application.job?._id || "unknown";
      if (!byJob.has(jobId)) {
        byJob.set(jobId, { title: application.job?.title || "Opportunity", type: application.job?.type || "", applicants: [] });
      }
      byJob.get(jobId)!.applicants.push(application);
    }
    return Array.from(byJob.values());
  }, [data]);

  if (user?.role !== "company" && user?.role !== "admin") {
    return (
      <Shell>
        <SectionHeader title="Applicants" subtitle="Only companies and administrators can review applicants." />
      </Shell>
    );
  }

  return (
    <Shell>
      <SectionHeader
        title="Applicants"
        subtitle="Review the youth who applied to your opportunities and move each candidate through your hiring pipeline."
      />

      {isLoading && <p className="text-sm text-muted">Loading applicants…</p>}
      {isError && <p className="rounded-md bg-dangerSurface px-4 py-3 text-sm text-danger">{(error as Error)?.message || "Could not load applicants."}</p>}
      {!isLoading && !isError && groups.length === 0 && (
        <p className="rounded-md border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No applications yet. Once young people apply to your opportunities, they will appear here.
        </p>
      )}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-bold text-ink">{group.title}</h2>
              <span className="rounded bg-accent/10 px-2 py-1 text-xs font-semibold uppercase text-accent">{group.type}</span>
              <span className="text-sm text-muted">{group.applicants.length} applicant{group.applicants.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {group.applicants.map((application) => (
                <article key={application._id} className="card card-pad">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{application.student?.name || "Applicant"}</p>
                      <p className="text-sm text-muted">{application.student?.email}</p>
                    </div>
                    <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${statusStyles[application.status]}`}>
                      {application.status}
                    </span>
                  </div>

                  {application.student?.studentProfile && (
                    <p className="mt-2 text-sm text-muted">
                      {[application.student.studentProfile.program, application.student.studentProfile.university]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {application.student?.studentProfile?.skills?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {application.student.studentProfile.skills.slice(0, 8).map((skill) => (
                        <span key={skill} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted">{application.coverLetter}</p>

                  {application.cvUrl && (
                    <a
                      href={application.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
                    >
                      View CV <ExternalLink size={14} />
                    </a>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    {statusFlow
                      .filter((status) => status !== application.status)
                      .map((status) => (
                        <button
                          key={status}
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: application._id, status })}
                          className={`focus-ring rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
                            status === "rejected"
                              ? "border border-line text-muted hover:bg-secondary"
                              : "bg-brand text-night hover:bg-brandDark"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
