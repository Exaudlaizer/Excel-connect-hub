"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  BriefcaseBusiness,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Image as ImageIcon,
  UsersRound
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { MetricCard } from "@/components/MetricCard";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { AdminAds } from "@/components/admin/AdminAds";
import { AdminBranding } from "@/components/admin/AdminBranding";
import { AdminCommunity } from "@/components/admin/AdminCommunity";
import { AdminCourses, AdminJobs } from "@/components/admin/AdminContent";
import { AdminServices } from "@/components/admin/AdminServices";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Admin panel.
 *
 * One place to manage everything the platform holds: advertisements and their
 * artwork, employer opportunities, mentor courses, the services directory, the
 * community feed, and accounts. Each tab is a self-contained panel that owns its
 * own queries, so opening the panel does not load six sections at once.
 */

type Tab = "overview" | "ads" | "opportunities" | "courses" | "services" | "community" | "accounts" | "branding";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ads", label: "Advertisements", icon: Megaphone },
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "services", label: "Services", icon: LifeBuoy },
  { id: "community", label: "Community", icon: MessagesSquare },
  { id: "accounts", label: "Accounts", icon: UsersRound },
  { id: "branding", label: "Branding", icon: ImageIcon }
];

function Overview({ onJump }: { onJump: (tab: Tab) => void }) {
  const { token } = useAuth();

  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api<{ analytics: Record<string, number> }>("/admin/analytics", { token })
  });

  if (analytics.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="card card-pad">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-3 h-8 w-14" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (analytics.isError) {
    return <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} title="We could not load platform figures" />;
  }

  const data = analytics.data?.analytics;
  if (!data) return null;

  // These are counts read straight from the database, not estimates.
  const CARDS = [
    { label: "Accounts", value: data.users, detail: "Registered on the platform", icon: UsersRound },
    { label: "Students", value: data.students, detail: "Student accounts", icon: UsersRound },
    { label: "Businesses", value: data.companies, detail: "Employer and business accounts", icon: BriefcaseBusiness },
    { label: "Mentors", value: data.mentors, detail: "Publishing courses", icon: BookOpen },
    { label: "Opportunities", value: data.jobs, detail: "Jobs and internships posted", icon: BriefcaseBusiness },
    { label: "Applications", value: data.applications, detail: "Submitted by students", icon: UsersRound },
    { label: "Advertisements", value: data.ads, detail: "Business listings", icon: Megaphone },
    { label: "Courses", value: data.courses, detail: "Published by mentors", icon: BookOpen },
    { label: "Community posts", value: data.posts, detail: "Discussions and announcements", icon: MessagesSquare },
    { label: "Services", value: data.services, detail: "Active directory entries", icon: LifeBuoy }
  ];

  const QUEUES: Array<{ label: string; value: number; tab: Tab }> = [
    { label: "Advertisements", value: data.pendingAds, tab: "ads" },
    { label: "Opportunities", value: data.pendingJobs, tab: "opportunities" },
    { label: "Courses", value: data.pendingCourses, tab: "courses" }
  ];

  const totalPending = data.pendingApprovals;

  return (
    <div className="stack-gap">
      {/* Review queue first: it is the thing an administrator opens the panel
          to deal with. */}
      <section>
        <h2 className="text-heading text-ink">Awaiting review</h2>
        <p className="mt-1.5 text-sm text-muted">
          {totalPending === 0
            ? "Nothing is waiting for a decision."
            : `${totalPending} ${totalPending === 1 ? "item needs" : "items need"} a decision before students can see them.`}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {QUEUES.map(({ label, value, tab }) => (
            <button
              key={label}
              type="button"
              onClick={() => onJump(tab)}
              className="card card-interactive focus-ring card-pad text-left"
            >
              <p className="text-sm font-semibold text-muted">{label}</p>
              <p className={`mt-2 font-display text-3xl font-bold ${value > 0 ? "text-brand" : "text-ink"}`}>{value}</p>
              <p className="mt-2 text-sm text-muted">{value > 0 ? "Open the queue" : "All clear"}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-heading text-ink">Platform figures</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map(({ label, value, detail, icon }, index) => (
            <div key={label} className="stagger-item" style={{ ["--stagger-index" as string]: index }}>
              <MetricCard label={label} value={value ?? 0} detail={detail} icon={icon} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <Shell roles={["admin"]}>
      <SectionHeader
        title="Admin panel"
        subtitle="Manage content, artwork, advertisements, the services directory, and accounts."
      />

      {/* Scrolls horizontally on narrow screens rather than wrapping into a
          block of buttons that pushes the content off the fold. */}
      <div className="mb-8 -mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)]">
        <div className="flex min-w-max gap-6 border-b border-line" role="tablist" aria-label="Admin sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`nav-tab focus-ring flex items-center gap-2 whitespace-nowrap ${
                tab === id ? "nav-tab-active" : ""
              }`}
            >
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-fade-rise">
        {tab === "overview" && <Overview onJump={setTab} />}
        {tab === "ads" && <AdminAds />}
        {tab === "opportunities" && <AdminJobs />}
        {tab === "courses" && <AdminCourses />}
        {tab === "services" && <AdminServices />}
        {tab === "community" && <AdminCommunity />}
        {tab === "accounts" && <AdminUsers />}
        {tab === "branding" && <AdminBranding />}
      </div>
    </Shell>
  );
}
