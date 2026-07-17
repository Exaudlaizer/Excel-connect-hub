"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Search, ShieldAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { Role, useAuth } from "@/lib/auth";

type PendingRow = { id: string; title: string; meta: string };
type ManagedUser = {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  createdAt?: string;
};

const ROLE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "student", label: "Youth" },
  { value: "company", label: "Companies" },
  { value: "mentor", label: "Mentors" },
  { value: "admin", label: "Admins" }
];

const ROLE_LABEL: Record<Role, string> = {
  student: "Youth",
  company: "Company",
  mentor: "Mentor",
  admin: "Admin"
};

type Tab = "overview" | "users";

export default function AdminPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");

  const isAdmin = user?.role === "admin";

  const analytics = useQuery({
    queryKey: ["admin-analytics-full"],
    queryFn: () => api<{ analytics: Record<string, number> }>("/admin/analytics", { token }),
    enabled: isAdmin
  });

  const pendingJobs = useQuery({
    queryKey: ["pending-jobs"],
    queryFn: () => api<{ jobs: Array<{ _id: string; title: string; type: string }> }>("/jobs?status=pending", { token }),
    enabled: isAdmin
  });
  const pendingAds = useQuery({
    queryKey: ["pending-ads"],
    queryFn: () => api<{ ads: Array<{ _id: string; title: string; category: string }> }>("/ads?status=pending", { token }),
    enabled: isAdmin
  });
  const pendingCourses = useQuery({
    queryKey: ["pending-courses"],
    queryFn: () =>
      api<{ courses: Array<{ _id: string; title: string; category: string; provider?: { name: string } }> }>(
        "/courses?status=pending",
        { token }
      ),
    enabled: isAdmin
  });

  const users = useQuery({
    queryKey: ["admin-users", roleFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      return api<{ users: ManagedUser[] }>(`/users${qs ? `?${qs}` : ""}`, { token });
    },
    enabled: isAdmin && tab === "users"
  });

  const approve = useMutation({
    mutationFn: ({ path, status }: { path: string; status: "approved" | "rejected" }) =>
      api(path, { method: "PATCH", token, body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setActionError("");
      ["pending-jobs", "pending-ads", "pending-courses", "admin-analytics-full"].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Action failed")
  });

  const setUserStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      api(`/users/${id}/status`, { method: "PATCH", token, body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Could not update the account")
  });

  if (!isAdmin) {
    return (
      <Shell>
        <SectionHeader title="Admin" subtitle="Administrator access is required." />
        <div className="rounded-lg border border-line bg-card p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 text-muted" size={28} />
          <p className="font-semibold text-ink">You do not have access to this area.</p>
        </div>
      </Shell>
    );
  }

  const queues = [
    {
      title: "Jobs",
      rows: (pendingJobs.data?.jobs || []).map<PendingRow>((row) => ({ id: row._id, title: row.title, meta: row.type })),
      path: (id: string) => `/jobs/${id}/approval`
    },
    {
      title: "Advertisements",
      rows: (pendingAds.data?.ads || []).map<PendingRow>((row) => ({ id: row._id, title: row.title, meta: row.category })),
      path: (id: string) => `/ads/${id}/approval`
    },
    {
      title: "Mentor courses",
      rows: (pendingCourses.data?.courses || []).map<PendingRow>((row) => ({
        id: row._id,
        title: row.title,
        meta: row.provider?.name ? `${row.category} · by ${row.provider.name}` : row.category
      })),
      path: (id: string) => `/courses/${id}/approval`
    }
  ];

  return (
    <Shell>
      <SectionHeader
        title="Admin Dashboard"
        subtitle="Monitor platform growth, moderate pending listings, and manage accounts."
      />

      <div className="mb-6 inline-grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(["overview", "users"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`focus-ring rounded-md px-4 py-2 text-sm font-semibold capitalize transition-all ${
              tab === item ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {actionError && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}

      {tab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Youth" value={analytics.data?.analytics.students ?? "-"} detail="Registered youth accounts" />
            <MetricCard label="Companies" value={analytics.data?.analytics.companies ?? "-"} detail="Recruiters and SMEs" />
            <MetricCard label="Mentors" value={analytics.data?.analytics.mentors ?? "-"} detail="Offering courses" />
            <MetricCard label="Courses" value={analytics.data?.analytics.courses ?? "-"} detail="Mentor course listings" />
            <MetricCard
              label="Pending approvals"
              value={analytics.data?.analytics.pendingApprovals ?? "-"}
              detail="Requires moderation"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {queues.map((group) => (
              <div key={group.title} className="rounded-lg border border-line bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ink">{group.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {group.rows.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {group.rows.length === 0 && (
                    <div className="rounded-md border border-dashed border-line py-8 text-center">
                      <Inbox className="mx-auto mb-2 text-muted" size={20} />
                      <p className="text-sm text-muted">No pending items.</p>
                    </div>
                  )}
                  {group.rows.map((row) => (
                    <div key={row.id} className="rounded-md border border-line p-3">
                      <p className="font-semibold text-ink">{row.title}</p>
                      <p className="text-sm text-muted">{row.meta}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={approve.isPending}
                          onClick={() => approve.mutate({ path: group.path(row.id), status: "approved" })}
                          className="focus-ring rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-night transition-colors hover:bg-brandDark disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          disabled={approve.isPending}
                          onClick={() => {
                            if (confirm(`Reject "${row.title}"? The owner will need to resubmit.`)) {
                              approve.mutate({ path: group.path(row.id), status: "rejected" });
                            }
                          }}
                          className="focus-ring rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "users" && (
        <div className="rounded-lg border border-line bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {ROLE_FILTERS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setRoleFilter(item.value)}
                  className={`focus-ring rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    roleFilter === item.value ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email"
                className="focus-ring w-full rounded-md border border-line py-2 pl-9 pr-3 text-sm sm:w-64"
              />
            </div>
          </div>

          {users.isLoading && <p className="p-6 text-sm text-muted">Loading accounts...</p>}
          {users.isError && <p className="p-6 text-sm text-red-700">Could not load accounts.</p>}
          {users.data?.users.length === 0 && <p className="p-6 text-sm text-muted">No accounts match this filter.</p>}

          {(users.data?.users.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.users.map((row) => {
                    const isSelf = row.id === user?.id;
                    const suspended = row.status === "suspended";
                    return (
                      <tr key={row.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold text-ink">
                          {row.name}
                          {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {ROLE_LABEL[row.role] ?? row.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                              suspended ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* The API also blocks this: suspending yourself is an instant lockout. */}
                          {isSelf ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <button
                              disabled={setUserStatus.isPending}
                              onClick={() => {
                                const next = suspended ? "active" : "suspended";
                                if (next === "active" || confirm(`Suspend ${row.name}? They will be logged out.`)) {
                                  setUserStatus.mutate({ id: row.id, status: next });
                                }
                              }}
                              className={`focus-ring rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                                suspended
                                  ? "bg-brand text-night hover:bg-brandDark"
                                  : "border border-line text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {suspended ? "Reactivate" : "Suspend"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
