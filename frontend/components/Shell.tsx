"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, BriefcaseBusiness, LayoutDashboard, Megaphone, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Role, useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Role[];
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { href: "/applicants", label: "Applicants", icon: UsersRound, roles: ["company", "admin"] },
  { href: "/marketplace", label: "Marketplace", icon: Megaphone },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["admin"] }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const visibleNav = nav.filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false));

  return (
    <div className="min-h-screen bg-surface">
      <aside className="sidebar-ambient fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-card p-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo size={42} />
          <span>
            <span className="block text-lg font-bold text-ink">Excel Smartic</span>
            <span className="block text-xs text-muted">Youth &amp; business · Tanzania</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "nav-item-active text-brand" : "text-slate-600 hover:text-ink"
                }`}
              >
                {/* Icon leads the colour shift — it reaches brand gold on hover
                    while the label only sharpens to ink, so the row brightens
                    without the whole thing lighting up at once. */}
                <Icon
                  size={18}
                  className={`transition-colors duration-200 ${
                    active ? "text-brand" : "text-slate-400 group-hover:text-brand"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-ink lg:hidden">
              <Logo size={26} /> Excel Smartic
            </Link>
            <div className="hidden text-sm text-muted lg:block">Youth, employer, SME, and training network</div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user?.name || "Guest"} {user ? `· ${user.role}` : ""}
              </span>
              {user ? (
                <button
                  className="focus-ring rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-50"
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                >
                  Logout
                </button>
              ) : (
                <Link className="focus-ring rounded-md bg-brand px-3 py-2 text-sm font-semibold text-night" href="/">
                  Login
                </Link>
              )}
            </div>
          </div>
        </header>
        <div className="p-4 pb-24 lg:p-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card lg:hidden">
        {visibleNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 py-2 text-[11px] transition-colors ${active ? "text-brand" : "text-slate-500"}`}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
