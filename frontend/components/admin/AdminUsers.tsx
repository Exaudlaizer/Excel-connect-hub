"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { PageMeta, Pagination } from "@/components/ui/Pagination";
import { ApiError, api } from "@/lib/api";
import { Role, useAuth } from "@/lib/auth";

type ManagedUser = {
  _id: string;
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: "active" | "suspended";
  emailVerified?: boolean;
  createdAt?: string;
};

const ROLE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "student", label: "Students" },
  { value: "company", label: "Businesses" },
  { value: "mentor", label: "Mentors" },
  { value: "admin", label: "Admins" }
];

const ROLES: Role[] = ["student", "company", "mentor", "admin"];

export function AdminUsers() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState("");

  // Debounced so typing a name does not fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useQuery({
    queryKey: ["admin-users", roleFilter, debounced, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (roleFilter) params.set("role", roleFilter);
      if (debounced) params.set("q", debounced);
      return api<{ users: ManagedUser[]; pagination: PageMeta }>(`/users?${params}`, { token });
    }
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
  }

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      api(`/users/${id}/status`, { method: "PATCH", token, body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not update that account.")
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api(`/users/${id}/role`, { method: "PATCH", token, body: JSON.stringify({ role }) }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not change that role.")
  });

  const rows = users.data?.users || [];

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setRoleFilter(item.value);
                setPage(1);
              }}
              aria-pressed={roleFilter === item.value}
              className={`focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                roleFilter === item.value ? "bg-brand text-night" : "bg-secondary text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden />
          <label htmlFor="user-search" className="sr-only">
            Search accounts
          </label>
          <input
            id="user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="field pl-9 sm:w-72"
          />
        </div>
      </div>

      {error && (
        <p className="alert alert-error mb-4" role="alert">
          <span>{error}</span>
        </p>
      )}

      {users.isLoading ? (
        <ListSkeleton rows={5} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} title="We could not load accounts" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No accounts match this filter"
          description="Try a different role, or clear the search."
        />
      ) : (
        <>
          {/* Table on wide screens; the same data as stacked cards on narrow
              ones, because a five-column table on a phone is unreadable. */}
          <div className="card hidden overflow-x-auto lg:block">
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
                {rows.map((row) => {
                  const isSelf = row.id === user?.id;
                  const suspended = row.status === "suspended";
                  return (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink">
                        {row.name}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                        {row.phone && <span className="block text-xs font-normal text-muted">{row.phone}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.email}
                        {!row.emailVerified && <span className="badge badge-warning ml-2">Unverified</span>}
                      </td>
                      <td className="px-4 py-3">
                        <label className="sr-only" htmlFor={`role-${row.id}`}>
                          Role for {row.name}
                        </label>
                        <select
                          id={`role-${row.id}`}
                          value={row.role}
                          disabled={isSelf || setRole.isPending}
                          onChange={(event) => setRole.mutate({ id: row.id, role: event.target.value as Role })}
                          className="field min-h-0 py-1.5 text-xs"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${suspended ? "badge-danger" : "badge-success"}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <button
                            type="button"
                            disabled={setStatus.isPending}
                            onClick={() => {
                              const next = suspended ? "active" : "suspended";
                              if (next === "active" || confirm(`Suspend ${row.name}? They will be signed out.`)) {
                                setStatus.mutate({ id: row.id, status: next });
                              }
                            }}
                            className={`btn btn-sm focus-ring ${suspended ? "btn-primary" : "btn-secondary"}`}
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

          <div className="space-y-2 lg:hidden">
            {rows.map((row, index) => {
              const isSelf = row.id === user?.id;
              const suspended = row.status === "suspended";
              return (
                <div
                  key={row.id}
                  className="stagger-item card p-4"
                  style={{ ["--stagger-index" as string]: index }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {row.name}
                        {isSelf && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{row.email}</p>
                    </div>
                    <span className={`badge shrink-0 ${suspended ? "badge-danger" : "badge-success"}`}>
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-m-${row.id}`}>
                      Role for {row.name}
                    </label>
                    <select
                      id={`role-m-${row.id}`}
                      value={row.role}
                      disabled={isSelf || setRole.isPending}
                      onChange={(event) => setRole.mutate({ id: row.id, role: event.target.value as Role })}
                      className="field min-h-0 w-auto py-1.5 text-xs"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    {!isSelf && (
                      <button
                        type="button"
                        disabled={setStatus.isPending}
                        onClick={() => {
                          const next = suspended ? "active" : "suspended";
                          if (next === "active" || confirm(`Suspend ${row.name}? They will be signed out.`)) {
                            setStatus.mutate({ id: row.id, status: next });
                          }
                        }}
                        className={`btn btn-sm focus-ring ${suspended ? "btn-primary" : "btn-secondary"}`}
                      >
                        {suspended ? "Reactivate" : "Suspend"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Pagination meta={users.data?.pagination} onChange={setPage} label="accounts" />
    </section>
  );
}
