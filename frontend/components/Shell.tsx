"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, BriefcaseBusiness, LayoutDashboard, Megaphone, UserRound, UsersRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { href: "/marketplace", label: "Marketplace", icon: Megaphone },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/admin", label: "Admin", icon: UsersRound }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
        <Link href="/dashboard" className="block">
          <p className="text-xl font-bold text-ink">Excel Connect</p>
          <p className="text-sm text-muted">Hub for Tanzania</p>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            if (item.href === "/admin" && user?.role !== "admin") return null;
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-teal-50 text-brand" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="font-bold text-ink lg:hidden">
              Excel Connect
            </Link>
            <div className="hidden text-sm text-muted lg:block">Student, employer, SME, and training network</div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user?.name || "Guest"} {user ? `· ${user.role}` : ""}
              </span>
              {user ? (
                <button
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                >
                  Logout
                </button>
              ) : (
                <Link className="focus-ring rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white" href="/">
                  Login
                </Link>
              )}
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-brand" : "text-slate-500"}`}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
