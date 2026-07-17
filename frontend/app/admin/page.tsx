"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-analytics-full"],
    queryFn: () => api<{ analytics: Record<string, number> }>("/admin/analytics", { token }),
    enabled: user?.role === "admin"
  });
  const pendingJobs = useQuery({
    queryKey: ["pending-jobs"],
    queryFn: () => api<{ jobs: Array<{ _id: string; title: string; type: string }> }>("/jobs?status=pending", { token }),
    enabled: user?.role === "admin"
  });
  const pendingAds = useQuery({
    queryKey: ["pending-ads"],
    queryFn: () => api<{ ads: Array<{ _id: string; title: string; category: string }> }>("/ads?status=pending", { token }),
    enabled: user?.role === "admin"
  });
  const pendingCourses = useQuery({
    queryKey: ["pending-courses"],
    queryFn: () => api<{ courses: Array<{ _id: string; title: string; category: string }> }>("/courses?status=pending", { token }),
    enabled: user?.role === "admin"
  });
  const approve = useMutation({
    mutationFn: ({ path, status }: { path: string; status: "approved" | "rejected" }) =>
      api(path, { method: "PATCH", token, body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["pending-ads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-full"] });
    }
  });

  if (user?.role !== "admin") {
    return (
      <Shell>
        <SectionHeader title="Admin" subtitle="Administrator access is required." />
      </Shell>
    );
  }

  return (
    <Shell>
      <SectionHeader title="Admin Dashboard" subtitle="Monitor platform growth and review pending jobs, advertisements, and courses through approval endpoints." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Youth" value={data?.analytics.students ?? "-"} detail="Registered youth accounts" />
        <MetricCard label="Companies" value={data?.analytics.companies ?? "-"} detail="Recruiters and providers" />
        <MetricCard label="Courses" value={data?.analytics.courses ?? "-"} detail="Training listings" />
        <MetricCard label="Pending approvals" value={data?.analytics.pendingApprovals ?? "-"} detail="Requires moderation" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "Jobs",
            rows: (pendingJobs.data?.jobs || []).map((row) => ({ id: row._id, title: row.title, meta: row.type })),
            path: (id: string) => `/jobs/${id}/approval`
          },
          {
            title: "Advertisements",
            rows: (pendingAds.data?.ads || []).map((row) => ({ id: row._id, title: row.title, meta: row.category })),
            path: (id: string) => `/ads/${id}/approval`
          },
          {
            title: "Courses",
            rows: (pendingCourses.data?.courses || []).map((row) => ({ id: row._id, title: row.title, meta: row.category })),
            path: (id: string) => `/courses/${id}/approval`
          }
        ].map((group) => (
          <div key={group.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">{group.title}</h2>
            <div className="mt-4 space-y-3">
              {group.rows.length === 0 && <p className="text-sm text-muted">No pending items.</p>}
              {group.rows.map((row) => (
                <div key={row.id} className="rounded-md border border-slate-100 p-3">
                  <p className="font-semibold text-ink">{row.title}</p>
                  <p className="text-sm text-muted">{row.meta}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => approve.mutate({ path: group.path(row.id), status: "approved" })} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-night">
                      Approve
                    </button>
                    <button onClick={() => approve.mutate({ path: group.path(row.id), status: "rejected" })} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
