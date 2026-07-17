import { AuthPanel } from "@/components/AuthPanel";
import { Logo } from "@/components/Logo";
import { BookOpen, BriefcaseBusiness, Megaphone } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-surface px-4 py-8">
      {/* animated gold ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-shimmer bg-[radial-gradient(1000px_500px_at_85%_-10%,rgba(183,134,43,0.16),transparent_60%),radial-gradient(800px_450px_at_-10%_110%,rgba(217,119,6,0.12),transparent_55%)] bg-[length:200%_200%]"
      />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="animate-fade-in">
          <div className="flex items-center gap-3">
            <Logo size={56} className="animate-float shadow-soft" />
            <span className="text-2xl font-bold text-ink">Excel Smartic</span>
          </div>
          <p className="mt-6 text-sm font-bold uppercase tracking-wide text-brand">Tanzania youth-business ecosystem</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Where <span className="bg-gold bg-clip-text text-transparent">young talent</span> meets opportunity
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            A practical network where youth find internships and jobs, companies recruit talent, small businesses
            advertise, and training providers publish short courses.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: BriefcaseBusiness, label: "Jobs and internships" },
              { icon: Megaphone, label: "SME marketplace" },
              { icon: BookOpen, label: "Short courses" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-line bg-card/80 p-4 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-brand/50 hover:shadow-gold"
                >
                  <Icon className="text-brand" size={22} />
                  <p className="mt-3 text-sm font-semibold text-ink">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>
        <AuthPanel />
      </div>
    </main>
  );
}
