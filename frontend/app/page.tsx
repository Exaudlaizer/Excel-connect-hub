import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  UserRound
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

/**
 * Landing page.
 *
 * Everything shown here is a section that actually exists in the product. There
 * are no counters, progress bars, match percentages, or activity feeds: those
 * would be numbers with nothing behind them. What the page promises is what a
 * new account can open on its first day.
 */

const SECTIONS = [
  {
    icon: BookOpen,
    title: "Learning",
    text: "Courses published by independent mentors, with the delivery mode, duration and price stated up front."
  },
  {
    icon: BriefcaseBusiness,
    title: "Opportunities",
    text: "Jobs and internships from registered employers. Apply from your account and follow each application's status."
  },
  {
    icon: MessagesSquare,
    title: "Community",
    text: "Discussions, questions, study groups and events, posted and answered by students on the platform."
  },
  {
    icon: LifeBuoy,
    title: "University services",
    text: "A directory of academic, career, wellbeing and financial support, curated by the platform administrators."
  },
  {
    icon: Megaphone,
    title: "Business ads",
    text: "Offers from local businesses aimed at students, reviewed before they appear in the catalogue."
  },
  {
    icon: UserRound,
    title: "Your profile",
    text: "University, programme, skills and CV in one place, ready to attach to every application you send."
  }
];

const STEPS = [
  { number: "01", title: "Create your account", text: "Choose whether you are joining as a student, a business, or a mentor." },
  { number: "02", title: "Complete your profile", text: "Add your university, programme and skills so employers can read them." },
  { number: "03", title: "Apply and take part", text: "Send applications, enrol in courses, and join the conversation." }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="glass-bar sticky top-0 z-20">
        <nav className="container-page flex items-center justify-between gap-4 py-4">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-xl">
            <Logo size={38} />
            <span className="min-w-0">
              <span className="block font-display text-base font-bold leading-tight text-ink">Excel Connect Hub</span>
              <span className="block text-[10px] font-semibold tracking-[0.16em] text-muted">
                LEARN · CONNECT · GROW
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex">
            <a href="#platform" className="transition-colors hover:text-ink">
              Platform
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-ink">
              How it works
            </a>
            <a href="#who-its-for" className="transition-colors hover:text-ink">
              Who it is for
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Link href="/login" className="btn btn-ghost btn-sm focus-ring hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm focus-ring">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ---------------------------------------------------------------------
          Hero
          --------------------------------------------------------------------- */}
      <section className="container-page pb-[var(--section-gap)] pt-12 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-rise">
            <p className="text-eyebrow">
              Excel Connect Hub
            </p>
            <h1 className="text-display mt-5 text-ink">
              Everything students need to move forward.
            </h1>
            <p className="mt-4 font-display text-lg italic text-muted sm:text-xl">Learn. Connect. Discover. Grow.</p>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted">
              A digital hub connecting students with learning resources, university services, communities,
              opportunities, and businesses.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary focus-ring">
                Get Started <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href="/opportunities" className="btn btn-secondary focus-ring">
                Explore Opportunities
              </Link>
            </div>

            <p className="mt-6 text-sm text-muted">
              Free for students. Businesses and mentors publish through a reviewed listing process.
            </p>
          </div>

          {/* -----------------------------------------------------------------
              Platform preview
              -----------------------------------------------------------------
              A map of the real sections of the product, each one a page that
              exists. No metrics are shown, because a new account has none.
              --------------------------------------------------------------- */}
          <div className="animate-fade-rise lg:pl-4" style={{ animationDelay: "120ms" }}>
            <div className="glass-card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                <Logo size={24} />
                <span className="text-sm font-bold text-ink">Your hub</span>
                <span className="badge badge-primary ml-auto">6 sections</span>
              </div>

              <div className="grid grid-cols-2 gap-px bg-line">
                {SECTIONS.map(({ icon: Icon, title }, index) => (
                  <div
                    key={title}
                    className="stagger-item flex flex-col gap-2 bg-card p-4"
                    style={{ ["--stagger-index" as string]: index + 2 }}
                  >
                    <Icon size={18} className="text-brand" aria-hidden />
                    <span className="text-sm font-bold text-ink">{title}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-line px-4 py-3">
                <p className="text-xs leading-5 text-muted">
                  Sign in to open each section. Your dashboard fills up as opportunities, courses and posts are
                  published.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          What the platform actually contains
          --------------------------------------------------------------------- */}
      <section id="platform" className="border-y border-line bg-card/40">
        <div className="container-page py-[var(--section-gap)]">
          <p className="text-eyebrow">The platform</p>
          <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 className="text-title max-w-xl text-ink">
              Six sections, one account.
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted">
              Each one is a working part of the platform. Nothing here is a preview or a waiting list.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="stagger-item card card-interactive p-5"
                style={{ ["--stagger-index" as string]: index }}
              >
                <Icon size={22} className="text-brand" aria-hidden />
                <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          How it works
          --------------------------------------------------------------------- */}
      <section id="how-it-works" className="container-page py-[var(--section-gap)]">
        <p className="text-eyebrow">How it works</p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-title text-ink">Three steps to a working account.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted">
              There is no waiting list and no approval step for students. Businesses and mentors publish through a
              review queue so that what students see has been checked first.
            </p>
          </div>
          <div className="space-y-4">
            {STEPS.map(({ number, title, text }) => (
              <div key={number} className="card flex gap-4 p-5">
                <span className="font-mono-ui text-sm font-medium text-brand">{number}</span>
                <div>
                  <h3 className="text-base font-bold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Who it is for
          --------------------------------------------------------------------- */}
      <section id="who-its-for" className="border-y border-line bg-card/40">
        <div className="container-page py-[var(--section-gap)]">
          <p className="text-eyebrow">Who it is for</p>
          <h2 className="text-title mt-4 text-ink">
            Three kinds of account.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Students",
                text: "Build a profile, enrol in courses, apply to opportunities, join discussions, and find university support."
              },
              {
                title: "Businesses and employers",
                text: "Post jobs and internships, review applicants through a hiring pipeline, and advertise offers to students."
              },
              {
                title: "Mentors",
                text: "Publish your own courses. The platform hosts and lists them — the course remains yours."
              }
            ].map(({ title, text }, index) => (
              <article
                key={title}
                className="stagger-item card p-6"
                style={{ ["--stagger-index" as string]: index }}
              >
                <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Close
          --------------------------------------------------------------------- */}
      <section className="container-page py-[var(--section-gap)]">
        <div className="card px-6 py-12 text-center sm:px-12">
          <h2 className="text-title mx-auto max-w-2xl text-ink">
            Start with the account, the rest follows.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted">
            Create your profile today and you are ready the moment the right opportunity is posted.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn btn-primary focus-ring">
              Get Started <ArrowRight size={17} aria-hidden />
            </Link>
            <Link href="/login" className="btn btn-secondary focus-ring">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="container-page flex flex-col gap-4 py-7 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Excel Connect Hub</span>
          <div className="flex flex-wrap gap-5">
            <a href="#platform" className="focus-ring transition-colors hover:text-ink">
              Platform
            </a>
            <Link href="/login" className="focus-ring transition-colors hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="focus-ring transition-colors hover:text-ink">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
