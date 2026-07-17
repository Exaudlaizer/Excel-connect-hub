"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { data } = useQuery({
    queryKey: ["admin-analytics", token],
    queryFn: () => api<{ analytics: Record<string, number> }>("/admin/analytics", { token }),
    enabled: user?.role === "admin" && Boolean(token)
  });

  return (
    <Shell>
      <SectionHeader
        title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
        subtitle="Manage opportunities, connect with talent, publish services, and keep the ecosystem moving."
      />

      {user?.role === "admin" && data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Users" value={data.analytics.users} detail="Total platform accounts" />
          <MetricCard label="Jobs" value={data.analytics.jobs} detail="Jobs and internships posted" />
          <MetricCard label="Applications" value={data.analytics.applications} detail="Youth submissions" />
          <MetricCard label="Pending" value={data.analytics.pendingApprovals} detail="Approvals awaiting review" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Opportunities" value="Live" detail="Browse internships and jobs approved by admins" />
          <MetricCard label="Marketplace" value="Open" detail="Promote youth ventures and small businesses" />
          <MetricCard label="Learning" value="Growing" detail="Learn directly from mentors" />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { href: "/opportunities", title: "Find or post opportunities", text: "Youth apply while companies manage listings and applicants." },
          { href: "/marketplace", title: "Advertise a business", text: "Publish products, services, events, housing, and campus offers." },
          { href: "/learning", title: "Build skills", text: "Training providers add courses and youth enroll." }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg border border-line bg-card p-5 shadow-sm hover:border-brand">
            <h2 className="font-bold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
