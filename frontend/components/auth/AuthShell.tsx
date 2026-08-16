import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

const pillars = [
  { icon: BookOpenCheck, label: "Learning resources" },
  { icon: Network, label: "Student community" },
  { icon: ShieldCheck, label: "University support" }
];

export function AuthShell({ children, eyebrow = "Secure student access" }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <main className="auth-stage min-h-screen p-3 sm:p-5 lg:p-6">
      <div className="auth-frame mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[1.75rem] border border-white/10 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[minmax(0,1.12fr)_minmax(28rem,0.88fr)]">
        <section className="auth-story relative hidden overflow-hidden p-8 text-white lg:flex lg:flex-col xl:p-12">
          <div className="auth-orbit auth-orbit-one" aria-hidden />
          <div className="auth-orbit auth-orbit-two" aria-hidden />
          <div className="auth-grid" aria-hidden />
          <Link href="/login" className="relative z-10 inline-flex w-fit items-center gap-3 rounded-xl focus-ring-dark">
            <Logo size={46} className="shadow-[0_0_28px_rgba(219,177,79,0.28)]" />
            <span>
              <span className="block font-display text-xl font-semibold tracking-tight">Excel Connect Hub</span>
              <span className="block text-xs tracking-[0.14em] text-white/50">LEARN · CONNECT · GROW</span>
            </span>
          </Link>

          <div className="relative z-10 my-auto max-w-xl py-16">
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brandLight">
              <Sparkles size={15} /> {eyebrow}
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] xl:text-6xl">
              Your next opportunity starts with a stronger connection.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 xl:text-lg">
              A focused digital space for students to access learning, build confidence, and move toward meaningful work.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {pillars.map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                <Icon className="text-brandLight" size={19} aria-hidden />
                <p className="mt-5 text-sm font-medium leading-5 text-slate-100">{label}</p>
              </div>
            ))}
          </div>
          <p className="relative z-10 mt-8 flex items-center gap-1 text-sm text-white/45">
            Built for progress, with your privacy in mind <ArrowUpRight size={15} />
          </p>
        </section>

        <section className="auth-form-zone relative flex min-h-[calc(100vh-1.5rem)] items-center justify-center px-4 py-9 sm:px-8 lg:min-h-0 lg:px-10 xl:px-16">
          <div className="auth-mobile-mark absolute left-5 top-5 flex items-center gap-2 lg:hidden">
            <Logo size={33} />
            <span className="font-display text-base font-semibold text-white">Excel Connect Hub</span>
          </div>
          <div className="w-full max-w-md animate-auth-in">{children}</div>
        </section>
      </div>
    </main>
  );
}
