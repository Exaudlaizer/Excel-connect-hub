"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessagesSquare,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { Role, useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { RequireAuth } from "@/components/RequireAuth";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
  roles?: Role[];
};

/**
 * One navigation definition, rendered three ways (sidebar, mobile bar, mobile
 * sheet). There is deliberately no second list anywhere: adding a section here
 * adds it everywhere, and the three surfaces can never drift apart.
 */
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, description: "Your overview" },
  { href: "/learning", label: "Learning", icon: BookOpen, description: "Courses from mentors" },
  { href: "/opportunities", label: "Opportunities", icon: BriefcaseBusiness, description: "Jobs and internships" },
  { href: "/community", label: "Community", icon: MessagesSquare, description: "Discussions and groups" },
  { href: "/services", label: "Services", icon: LifeBuoy, description: "University and student support" },
  { href: "/business-ads", label: "Business Ads", icon: Megaphone, description: "Offers from local businesses" },
  { href: "/profile", label: "Profile", icon: UserRound, description: "Your details" },
  {
    href: "/applicants",
    label: "Applicants",
    icon: UsersRound,
    description: "Review who applied",
    roles: ["company", "admin"]
  },
  { href: "/admin", label: "Admin", icon: ShieldCheck, description: "Moderation and accounts", roles: ["admin"] }
];

// The four that get a permanent slot in the mobile bar; the rest live behind
// "More" so the bar never overflows on a small screen.
const MOBILE_PRIMARY = ["/dashboard", "/opportunities", "/community", "/business-ads"];

const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  company: "Business",
  mentor: "Mentor",
  admin: "Administrator"
};

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  // Matches the section, so /community/abc still lights up Community.
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleNav = NAV.filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false));
  const primaryNav = visibleNav.filter((item) => MOBILE_PRIMARY.includes(item.href));
  const current = visibleNav.find((item) => isActive(pathname, item.href));

  // Any navigation closes whatever was open, so a menu never survives a route
  // change and hangs over the new page.
  useEffect(() => {
    setMenuOpen(false);
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <RequireAuth roles={roles}>
      <div className="min-h-screen bg-surface">
        {/* ---------------------------------------------------------------
            Desktop sidebar
            --------------------------------------------------------------- */}
        <aside className="glass-rail fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
          <Link href="/dashboard" className="focus-ring flex items-center gap-3 px-5 py-5">
            <Logo size={38} />
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-bold text-ink">Excel Connect Hub</span>
              <span className="block truncate text-[10px] font-semibold tracking-[0.16em] text-muted">
                LEARN · CONNECT · GROW
              </span>
            </span>
          </Link>

          <nav aria-label="Sections" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {visibleNav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`nav-item focus-ring ${active ? "nav-item-active" : ""}`}
                >
                  <Icon size={17} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-line p-3">
            <Link
              href="/settings"
              aria-current={isActive(pathname, "/settings") ? "page" : undefined}
              className={`nav-item focus-ring ${isActive(pathname, "/settings") ? "nav-item-active" : ""}`}
            >
              <Settings size={17} aria-hidden />
              Settings
            </Link>
          </div>
        </aside>

        <div className="lg:pl-64">
          {/* -------------------------------------------------------------
              Top bar
              ------------------------------------------------------------- */}
          <header className="glass-bar sticky top-0 z-20">
            <div className="container-page flex items-center justify-between gap-3 py-3">
              <Link href="/dashboard" className="focus-ring flex items-center gap-2 lg:hidden">
                <Logo size={28} />
                <span className="font-display text-sm font-bold text-ink">Excel Connect Hub</span>
              </Link>

              <p className="hidden min-w-0 lg:block">
                <span className="block text-sm font-bold text-ink">{current?.label ?? "Excel Connect Hub"}</span>
                <span className="block truncate text-xs text-muted">{current?.description ?? "Student platform"}</span>
              </p>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="focus-ring flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 transition-colors hover:bg-secondary"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-night">
                    {(user?.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[9rem] truncate text-xs font-bold text-ink">{user?.name}</span>
                    <span className="block text-[10px] text-muted">{user ? ROLE_LABEL[user.role] : ""}</span>
                  </span>
                  <ChevronDown size={14} className="text-muted" aria-hidden />
                </button>

                {menuOpen && (
                  <>
                    {/* Click-away layer. Sits under the menu but over the page. */}
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="glass animate-fade-in absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl shadow-lift"
                    >
                      <div className="border-b border-line px-3 py-2.5">
                        <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                        <p className="truncate text-xs text-muted">{user?.email}</p>
                      </div>
                      <Link href="/profile" role="menuitem" className="nav-item focus-ring m-1">
                        <UserRound size={16} aria-hidden /> Profile
                      </Link>
                      <Link href="/settings" role="menuitem" className="nav-item focus-ring m-1">
                        <Settings size={16} aria-hidden /> Settings
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={signOut}
                        className="nav-item focus-ring m-1 w-[calc(100%-0.5rem)] text-danger hover:bg-dangerSurface hover:text-danger"
                      >
                        <LogOut size={16} aria-hidden /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Keyed on the path so every route change replays the entrance. */}
          <main key={pathname} className="page-enter container-page page-shell">
            {children}
          </main>
        </div>

        {/* ---------------------------------------------------------------
            Mobile bar — four sections plus an overflow sheet for the rest
            --------------------------------------------------------------- */}
        <nav
          aria-label="Primary"
          className="glass-dock fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`mobile-nav-item focus-ring ${active ? "mobile-nav-item-active" : ""}`}
              >
                <Icon size={18} aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            className={`mobile-nav-item focus-ring ${sheetOpen ? "mobile-nav-item-active" : ""}`}
          >
            <Menu size={18} aria-hidden />
            More
          </button>
        </nav>

        {sheetOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setSheetOpen(false)}
              className="animate-fade-in absolute inset-0 cursor-default bg-black/60"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="All sections"
              className="glass animate-fade-rise absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">All sections</p>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="focus-ring rounded-lg p-1.5 text-muted hover:bg-secondary"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <div className="grid gap-1">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`nav-item focus-ring ${active ? "nav-item-active" : ""}`}
                    >
                      <Icon size={17} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        <span className="block truncate text-xs font-normal text-muted">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/settings"
                  className={`nav-item focus-ring ${isActive(pathname, "/settings") ? "nav-item-active" : ""}`}
                >
                  <Settings size={17} aria-hidden />
                  <span className="min-w-0">
                    <span className="block">Settings</span>
                    <span className="block text-xs font-normal text-muted">Appearance and account</span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
