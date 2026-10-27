import Link from "next/link";
import AuthLogo from "@/components/auth/AuthLogo";
import HeroPreview from "@/components/auth/HeroPreview";
import { AuthIcon, type AuthIconName } from "@/components/auth/AuthIcons";

// Split-screen frame for the authentication screens.
//
// Desktop / tablet (lg and up): hero on the left (~55%), the auth card on the
// right (~45%). Below `lg` the hero collapses to a compact brand header and the
// card is centred, so the form is always the first thing on a phone.
//
// `children` is the form itself. Everything in this file is presentation - the
// forms keep their own state, validation and Supabase calls.

const FEATURES: { icon: AuthIconName; label: string }[] = [
  { icon: "checkCircle", label: "Manage Tasks" },
  { icon: "flame", label: "Track Habits" },
  { icon: "calendar", label: "View Calendar" },
  { icon: "trend", label: "See Your Progress" },
];

export default function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-canvas relative flex min-h-screen flex-col text-slate-100">
      {/* Faint grid, masked toward the edges. Purely decorative. */}
      <div className="auth-grid pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />

      {/* Compact brand bar: phones and tablets only. */}
      <header className="relative z-10 flex items-center justify-center px-5 pb-2 pt-8 lg:hidden">
        <Link href="/" className="rounded-2xl" aria-label="DayForge home">
          <AuthLogo size="sm" />
        </Link>
      </header>

      <main className="relative z-10 grid flex-1 items-center gap-10 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-6 lg:px-0 lg:pb-0 lg:pt-0">
        {/* ------------------------------- Hero ------------------------------- */}
        <section className="hidden min-h-screen flex-col justify-center px-4 py-12 lg:flex xl:px-14">
          <div className="mx-auto w-full max-w-xl">
            <Link href="/" className="inline-flex rounded-2xl" aria-label="DayForge home">
              <AuthLogo />
            </Link>

            {/* Badge */}
            <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden="true" />
              Plan <span className="text-brand-500/70">•</span> Track{" "}
              <span className="text-brand-500/70">•</span> Build{" "}
              <span className="text-brand-500/70">•</span> A Better You
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-[3.35rem]">
              Turn Your Days Into{" "}
              <span className="auth-gradient-text">Progress</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-400">
              Organize tasks, build habits, track your progress and create the best
              version of yourself — one day at a time.
            </p>

            {/* Feature highlights */}
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4">
              {FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-300">
                    <AuthIcon name={feature.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-slate-200">{feature.label}</span>
                </li>
              ))}
            </ul>

            {/* Floating dashboard preview */}
            <div className="mt-10">
              <HeroPreview />
            </div>

            <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
              <AuthIcon name="sparkles" className="h-3.5 w-3.5 text-brand-400" />
              Small steps every day
              <AuthIcon name="arrowRight" className="h-3.5 w-3.5 text-slate-600" />
              <span className="font-medium text-slate-400">Big results.</span>
            </p>
          </div>
        </section>

        {/* -------------------------- Authentication -------------------------- */}
        <section className="flex w-full items-center justify-center lg:min-h-screen lg:border-l lg:border-white/5 lg:bg-navy-950/25 lg:px-6 xl:px-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  );
}

// The dark glass card every auth form sits in.
export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-glass relative overflow-hidden rounded-[1.5rem] border border-brand-500/25 p-6 shadow-card sm:p-8">
      {/* A single violet highlight along the top edge. */}
      <span
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
