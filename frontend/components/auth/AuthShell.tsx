import Link from "next/link";
import { BookOpen, LifeBuoy, MessagesSquare } from "lucide-react";
import { Logo } from "@/components/Logo";

const PILLARS = [
  { icon: BookOpen, label: "Learning resources" },
  { icon: MessagesSquare, label: "Student community" },
  { icon: LifeBuoy, label: "University support" }
];

/**
 * Frame shared by every authentication screen.
 *
 * Deliberately plain: a sign-in page earns trust by being legible and
 * predictable, not by being decorated. The left panel states what the platform
 * is; the right panel is the form and nothing else.
 */
export function AuthShell({ children, eyebrow = "Secure student access" }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.05fr_minmax(27rem,0.95fr)]">
        {/* ---------------------------------------------------------------
            Context panel — desktop only
            --------------------------------------------------------------- */}
        <section className="relative hidden flex-col justify-between border-r border-line bg-card p-10 lg:flex xl:p-14">
          <Link href="/" className="focus-ring inline-flex w-fit items-center gap-3 rounded-xl">
            <Logo size={42} />
            <span>
              <span className="block font-display text-lg font-bold text-ink">Excel Connect Hub</span>
              <span className="block text-[10px] font-semibold tracking-[0.16em] text-muted">
                LEARN · CONNECT · GROW
              </span>
            </span>
          </Link>

          <div className="max-w-lg py-14">
            <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink xl:text-5xl">
              Everything students need to move forward.
            </h1>
            <p className="mt-5 text-base leading-7 text-muted">
              A digital hub connecting students with learning resources, university services, communities,
              opportunities, and businesses.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {PILLARS.map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl border border-line bg-elevated p-4">
                <Icon className="text-brand" size={18} aria-hidden />
                <p className="mt-4 text-sm font-semibold leading-5 text-ink">{label}</p>
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
