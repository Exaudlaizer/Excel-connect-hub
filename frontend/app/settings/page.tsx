"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, Loader2, Mail, Palette, ShieldCheck, UserRound } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { THEMES, ThemeName, useTheme } from "@/components/ThemeProvider";
import { ApiError, api } from "@/lib/api";
import { AuthUser, useAuth } from "@/lib/auth";

/**
 * Settings.
 *
 * Appearance is first because it is the setting people come here to change. The
 * theme is applied the moment a swatch is clicked — the write to the account
 * happens in the background and never blocks the change.
 */

type Tab = "appearance" | "account";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "account", label: "Account", icon: UserRound }
];

function ThemeCard({ theme, selected, onSelect }: { theme: (typeof THEMES)[number]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`focus-ring group relative overflow-hidden rounded-xl border text-left transition-all duration-200 ${
        selected ? "border-brand shadow-lift" : "border-line hover:border-brand/50 hover:shadow-lift"
      }`}
    >
      {/* A miniature of the theme, painted from its own palette rather than the
          one currently applied — so each card previews what it will look like. */}
      <div className="flex h-24 flex-col gap-1.5 p-3" style={{ backgroundColor: theme.swatch[0] }}>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.swatch[2] }} />
          <span className="h-1.5 w-12 rounded-full" style={{ backgroundColor: theme.swatch[1] }} />
        </div>
        <div className="flex-1 rounded-md" style={{ backgroundColor: theme.swatch[1] }} />
        <div className="flex gap-1.5">
          <span className="h-3 w-10 rounded" style={{ backgroundColor: theme.swatch[2] }} />
          <span className="h-3 flex-1 rounded" style={{ backgroundColor: theme.swatch[1] }} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 bg-card p-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">{theme.name}</span>
          <span className="mt-0.5 block text-xs leading-4 text-muted">{theme.description}</span>
        </span>
        {selected && (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-night">
            <Check size={12} aria-hidden />
          </span>
        )}
      </div>
    </button>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <h2 className="text-heading text-ink">Theme</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Applies across the whole platform and is saved to your account, so it follows you to any device you sign in
        on.
      </p>

      <div
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        role="radiogroup"
        aria-label="Platform theme"
      >
        {THEMES.map((item) => (
          <ThemeCard
            key={item.id}
            theme={item}
            selected={theme === item.id}
            onSelect={() => setTheme(item.id as ThemeName)}
          />
        ))}
      </div>

      <div className="alert alert-info mt-6">
        <Palette size={17} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          If your device is set to reduce motion, animations across the platform are shortened automatically. No
          setting is needed.
        </span>
      </div>
    </section>
  );
}

function AccountTab() {
  const { user, token, applyUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<{ user: AuthUser }>("/users/me", { method: "PATCH", token, body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      setError("");
      setSaved(true);
      applyUser(data.user);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not save your changes. Please try again.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();

    if (name.length < 2) return setError("Enter your full name.");
    if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) return setError("Enter a valid phone number, or leave it blank.");

    save.mutate({ name, phone: phone || null });
  }

  return (
    <section className="max-w-2xl">
      <h2 className="text-heading text-ink">Account details</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Your email address and role cannot be changed here. Contact an administrator if either is wrong.
      </p>

      <form onSubmit={submit} className="card card-pad mt-6">
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="name">
              Full name
            </label>
            <input id="name" name="name" defaultValue={user?.name} required className="field" />
          </div>

          <div>
            <label className="field-label" htmlFor="phone">
              Phone number
            </label>
            <input id="phone" name="phone" type="tel" defaultValue={user?.phone || ""} className="field" />
          </div>

          <div>
            <span className="field-label">Email address</span>
            <p className="flex items-center gap-2 rounded-lg border border-line bg-secondary px-3 py-2.5 text-sm text-muted">
              <Mail size={15} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{user?.email}</span>
              {user?.emailVerified ? (
                <span className="badge badge-success shrink-0">Verified</span>
              ) : (
                <span className="badge badge-warning shrink-0">Unverified</span>
              )}
            </p>
          </div>

          <div>
            <span className="field-label">Account type</span>
            <p className="flex items-center gap-2 rounded-lg border border-line bg-secondary px-3 py-2.5 text-sm capitalize text-muted">
              <ShieldCheck size={15} className="shrink-0" aria-hidden />
              {user?.role}
            </p>
          </div>
        </div>

        {error && (
          <p className="alert alert-error mt-4" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        {saved && (
          <p className="alert alert-success mt-4" role="status">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>Your changes have been saved.</span>
          </p>
        )}

        <button type="submit" disabled={save.isPending} className="btn btn-primary focus-ring mt-5">
          {save.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <Shell>
      <SectionHeader title="Settings" subtitle="Choose how Excel Connect Hub looks and keep your account details current." />

      <div className="mb-8 flex gap-6 border-b border-line" role="tablist" aria-label="Settings sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`nav-tab focus-ring flex items-center gap-2 ${tab === id ? "nav-tab-active" : ""}`}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-rise">
        {tab === "appearance" ? <AppearanceTab /> : <AccountTab />}
      </div>
    </Shell>
  );
}
