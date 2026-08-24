"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Pin,
  UserRound
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Dashboard overview.
 *
 * Every panel is fed by a real endpoint. Where a section has no rows yet it says
 * so — there are no placeholder counts, progress bars, or recommendations, since
 * none of those have data behind them.
 */

type Job = {
  _id: string;
  title: string;
  type: string;
  location: string;
  company?: { name: string; companyProfile?: { companyName?: string } };
};

type Course = { _id: string; title: string; category: string; provider?: { name: string } };

type Post = { _id: string; title: string; category: string; pinned: boolean; author?: { name: string } };

type Ad = { _id: string; title: string; businessName?: string; category: string };

type Application = { _id: string; status: string; job?: { title: string } };

const QUICK_LINKS = [
  { href: "/learning", label: "Learning", icon: BookOpen, text: "Courses published by mentors" },
  { href: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness, text: "Jobs and internships" },
  { href: "/community", label: "Community", icon: MessagesSquare, text: "Discussions and study groups" },
  { href: "/services", label: "Services", icon: LifeBuoy, text: "University and student support" },
  { href: "/business-ads", label: "Business Ads", icon: Megaphone, text: "Offers for students" },
  { href: "/profile", label: "Profile", icon: UserRound, text: "Keep your details current" }
];

/** One panel: header, then loading / error / empty / content. */
function Panel({
  title,
  href,
  linkLabel,
  query,
  emptyTitle,
  emptyText,
  icon,
  children
}: {
  title: string;
  href: string;
  linkLabel: string;
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; isEmpty: boolean };
  emptyTitle: string;
  emptyText: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
        <Link href={href} className="focus-ring flex shrink-0 items-center gap-1 rounded text-sm font-semibold text-brand hover:underline">
          {linkLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} title={`We could not load ${title.toLowerCase()}`} />
      ) : query.isEmpty ? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyText} />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function Row({ href, title, meta, badge }: { href: string; title: string; meta: string; badge?: React.ReactNode }) {
  return (
    <Link href={href} className="card card-interactive focus-ring flex min-w-0 items-center justify-between gap-3 p-3.5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink">{title}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      {badge}
    </Link>
  );
}

export default function DashboardPage() {
  const { user, token, needsProfile } = useAuth();

  const jobs = useQuery({
    queryKey: ["dashboard-jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs", { token })
  });

  const courses = useQuery({
    queryKey: ["dashboard-courses"],
    queryFn: () => api<{ courses: Course[] }>("/courses", { token })
  });

  const posts = useQuery({
    queryKey: ["dashboard-posts"],
    queryFn: () => api<{ posts: Post[] }>("/community?limit=20", { token })
  });

  const ads = useQuery({
    queryKey: ["dashboard-ads"],
    queryFn: () => api<{ ads: Ad[] }>("/ads", { token })
  });

  const applications = useQuery({
    queryKey: ["dashboard-applications"],
    queryFn: () => api<{ applications: Application[] }>("/applications/mine", { token }),
    enabled: user?.role === "student" && Boolean(token)
  });

  const analytics = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: () => api<{ analytics: Record<string, number> }>("/admin/analytics", { token }),
    enabled: user?.role === "admin" && Boolean(token)
  });

  // Approved ads only for the highlight strip; the catalogue page shows the
  // owner their own pending submissions.
  const approvedAds = (ads.data?.ads || []).slice(0, 3);
  const announcements = (posts.data?.posts || []).filter((post) => post.pinned).slice(0, 3);
  const recentPosts = (posts.data?.posts || []).filter((post) => !post.pinned).slice(0, 3);
  const myApplications = applications.data?.applications || [];

  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <Shell>
      <SectionHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        subtitle="Your learning, opportunities, community and support — all from one account."
      />

      {/* Prompt rather than a fabricated completion percentage. */}
      {needsProfile && (
        <div className="alert alert-info mb-6" role="status">
          <UserRound size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span className="flex-1">
            Your profile is not complete yet. Employers and mentors read it when you apply or enrol.
          </span>
          <Link href="/profile" className="btn btn-primary btn-sm focus-ring shrink-0">
            Complete profile
          </Link>
        </div>
      )}

      {user?.role === "admin" && analytics.data && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Accounts" value={analytics.data.analytics.users} detail="Registered on the platform" icon={UserRound} />
          <MetricCard label="Opportunities" value={analytics.data.analytics.jobs} detail="Jobs and internships posted" icon={BriefcaseBusiness} />
          <MetricCard label="Courses" value={analytics.data.analytics.courses} detail="Published by mentors" icon={BookOpen} />
          <MetricCard
            label="Awaiting review"
            value={analytics.data.analytics.pendingApprovals}
            detail="Jobs, ads and courses in the queue"
            icon={Pin}
          />
        </div>
      )}

      {user?.role === "student" && myApplications.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Your applications</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myApplications.slice(0, 3).map((application, index) => (
              <div
                key={application._id}
                className="stagger-item card p-4"
                style={{ ["--stagger-index" as string]: index }}
              >
                <p className="truncate text-sm font-bold text-ink">{application.job?.title || "Opportunity"}</p>
                <span className="badge badge-primary mt-2">{application.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid min-w-0 gap-8 lg:grid-cols-2">
        <Panel
          title="Announcements"
          href="/community"
          linkLabel="Community"
          icon={Pin}
          emptyTitle="No announcements yet"
          emptyText="Platform announcements from administrators will appear here."
          query={{
            isLoading: posts.isLoading,
            isError: posts.isError,
            error: posts.error,
            refetch: posts.refetch,
            isEmpty: announcements.length === 0
          }}
        >
          {announcements.map((post) => (
            <Row
              key={post._id}
              href={`/community/${post._id}`}
              title={post.title}
              meta={post.author?.name ? `Posted by ${post.author.name}` : "Announcement"}
              badge={<span className="badge badge-warning shrink-0">Pinned</span>}
            />
          ))}
        </Panel>

        <Panel
          title="Recent opportunities"
          href="/opportunities"
          linkLabel="See all"
          icon={BriefcaseBusiness}
          emptyTitle="No opportunities yet"
          emptyText="New jobs and internships will appear here once employers publish them."
          query={{
            isLoading: jobs.isLoading,
            isError: jobs.isError,
            error: jobs.error,
            refetch: jobs.refetch,
            isEmpty: (jobs.data?.jobs?.length ?? 0) === 0
          }}
        >
          {(jobs.data?.jobs || []).slice(0, 3).map((job) => (
            <Row
              key={job._id}
              href="/opportunities"
              title={job.title}
              meta={`${job.company?.companyProfile?.companyName || job.company?.name || "Employer"} · ${job.location}`}
              badge={<span className="badge shrink-0">{job.type}</span>}
            />
          ))}
        </Panel>

        <Panel
          title="Recent courses"
          href="/learning"
          linkLabel="See all"
          icon={BookOpen}
          emptyTitle="No courses yet"
          emptyText="Courses appear here as mentors publish them and administrators approve them."
          query={{
            isLoading: courses.isLoading,
            isError: courses.isError,
            error: courses.error,
            refetch: courses.refetch,
            isEmpty: (courses.data?.courses?.length ?? 0) === 0
          }}
        >
          {(courses.data?.courses || []).slice(0, 3).map((course) => (
            <Row
              key={course._id}
              href="/learning"
              title={course.title}
              meta={course.provider?.name ? `by ${course.provider.name}` : course.category}
              badge={<span className="badge shrink-0">{course.category}</span>}
            />
          ))}
        </Panel>

        <Panel
          title="From the community"
          href="/community"
          linkLabel="See all"
          icon={MessagesSquare}
          emptyTitle="No discussions yet"
          emptyText="Start a discussion, ask a question, or form a study group."
          query={{
            isLoading: posts.isLoading,
            isError: posts.isError,
            error: posts.error,
            refetch: posts.refetch,
            isEmpty: recentPosts.length === 0
          }}
        >
          {recentPosts.map((post) => (
            <Row
              key={post._id}
              href={`/community/${post._id}`}
              title={post.title}
              meta={post.author?.name ? `by ${post.author.name}` : "Community"}
              badge={<span className="badge shrink-0">{post.category}</span>}
            />
          ))}
        </Panel>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Business offers</h2>
          <Link href="/business-ads" className="focus-ring flex items-center gap-1 rounded text-sm font-semibold text-brand hover:underline">
            Business Ads <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        {ads.isLoading ? (
          <ListSkeleton rows={2} />
        ) : ads.isError ? (
          <ErrorState error={ads.error} onRetry={ads.refetch} title="We could not load business offers" />
        ) : approvedAds.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No advertisements yet"
            description="Businesses can reach students with relevant products, services, events and offers. Approved listings appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {approvedAds.map((ad, index) => (
              <Link
                key={ad._id}
                href="/business-ads"
                className="stagger-item card card-interactive focus-ring p-4"
                style={{ ["--stagger-index" as string]: index }}
              >
                <span className="badge badge-primary">{ad.category}</span>
                <p className="mt-3 truncate text-sm font-bold text-ink">{ad.title}</p>
                <p className="truncate text-xs text-muted">{ad.businessName || "Local business"}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Explore the platform</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon, text }, index) => (
            <Link
              key={href}
              href={href}
              className="stagger-item card card-interactive focus-ring p-5"
              style={{ ["--stagger-index" as string]: index }}
            >
              <Icon size={20} className="text-brand" aria-hidden />
              <p className="mt-3 text-sm font-bold text-ink">{label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
