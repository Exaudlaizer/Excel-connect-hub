import { AuthPanel } from "@/components/AuthPanel";
import { BookOpen, BriefcaseBusiness, Megaphone } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7f9fc_0%,#ecfdf5_55%,#fff7ed_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-sm font-bold uppercase tracking-wide text-brand">Tanzania student-business ecosystem</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-ink sm:text-5xl">Excel Connect Hub</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            A practical network where students find internships, companies recruit talent, small businesses advertise,
            and training providers publish short courses.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: BriefcaseBusiness, label: "Jobs and internships" },
              { icon: Megaphone, label: "SME marketplace" },
              { icon: BookOpen, label: "Short courses" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm">
                  <Icon className="text-accent" size={22} />
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
