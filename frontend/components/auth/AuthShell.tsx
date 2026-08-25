"use client";

import Link from "next/link";
import { BookOpen, LifeBuoy, MessagesSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSiteSettings } from "@/lib/siteSettings";

const PILLARS = [
  { icon: BookOpen, label: "Learning resources" },
  { icon: MessagesSquare, label: "Student community" },
  { icon: LifeBuoy, label: "University support" }
];

/**
 * Frame shared by every authentication screen.
 *
 * The left context panel carries the background image an admin uploads under
 * Branding, if any. When none is set it falls back to the plain card surface, so
 * the page is never broken by a missing image — the image is an enhancement, not
 * a dependency. A dark scrim is laid over any uploaded image so the text on top
 * stays legible whatever the photo behind it.
 */
export function AuthShell({ children, eyebrow = "Secure student access" }: { children: React.ReactNode; eyebrow?: string }) {
  const settings = useSiteSettings();
  const background = settings.authBackground?.url;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.05fr_minmax(27rem,0.95fr)]">
        {/* ---------------------------------------------------------------
            Context panel — desktop only
            --------------------------------------------------------------- */}
        <section
          className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-card p-10 lg:flex xl:p-14"
          style={
            background
              ? {
                  backgroundImage: `linear-gradient(180deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.72)), url("${background}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }
              : undefined
          }
        >
          {/* On a photo background the text needs the light-on-dark treatment; the
              scrim above guarantees the contrast regardless of the image. */}
          <Link href="/" className="focus-ring relative z-10 inline-flex w-fit items-center gap-3 rounded-xl">
            <Logo size={42} />
            <span>
              <span className={`block font-display text-lg font-bold ${background ? "text-white" : "text-ink"}`}>
                Excel Connect Hub
              </span>
              <span
                className={`block text-[10px] font-semibold tracking-[0.16em] ${
                  background ? "text-white/70" : "text-muted"
                }`}
              >
                LEARN · CONNECT · GROW
              </span>
            </span>
          </Link>

          <div className="relative z-10 max-w-lg py-14">
            <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
            <h1
              className={`mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight xl:text-5xl ${
                background ? "text-white" : "text-ink"
              }`}
            >
              Everything students need to move forward.
            </h1>
            <p className={`mt-5 text-base leading-7 ${background ? "text-white/80" : "text-muted"}`}>
              A digital hub connecting students with learning resources, university services, communities,
              opportunities, and businesses.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {PILLARS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className={`rounded-xl border p-4 ${
                  background ? "border-white/15 bg-white/10 backdrop-blur-sm" : "border-line bg-elevated"
                }`}
              >
                <Icon className="text-brand" size={18} aria-hidden />
                <p className={`mt-4 text-sm font-semibold leading-5 ${background ? "text-white" : "text-ink"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Form panel
            --------------------------------------------------------------- */}
        <section className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
          <Link href="/" className="focus-ring mb-8 inline-flex w-fit items-center gap-2.5 rounded-xl lg:hidden">
            <Logo size={32} />
            <span className="font-display text-base font-bold text-ink">Excel Connect Hub</span>
          </Link>
          <div className="animate-fade-rise w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
