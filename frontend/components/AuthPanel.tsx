"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Building2, GraduationCap, Loader2, Presentation } from "lucide-react";
import { ApiError } from "@/lib/api";
import { SelfServiceRole, useAuth } from "@/lib/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

const ROLES: Array<{ value: SelfServiceRole; label: string; icon: React.ElementType; hint: string }> = [
  { value: "student", label: "Student", icon: GraduationCap, hint: "Learn, apply, and take part" },
  { value: "company", label: "Business", icon: Building2, hint: "Hire and advertise" },
  { value: "mentor", label: "Mentor", icon: Presentation, hint: "Publish your courses" }
];

type Errors = Partial<Record<"name" | "email" | "phone" | "password" | "confirmPassword" | "form", string>>;

function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(
    () =>
      [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(
        Boolean
      ).length,
    [password]
  );

  if (!password) return null;

  const label = ["Use at least 8 characters", "Weak", "Fair", "Strong", "Very strong"][score];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1 rounded-full transition-colors duration-300 ${
              index < score ? "bg-brand" : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLogin = mode === "login";

  const [role, setRole] = useState<SelfServiceRole>("student");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  // Only accept an in-app path, so a crafted ?next=https://… cannot turn the
  // sign-in form into an open redirect.
  const nextParam = searchParams.get("next");
  const redirectTo = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  function validate(form: FormData): Errors {
    const found: Errors = {};
    const email = String(form.get("email") || "").trim();
    const enteredPassword = String(form.get("password") || "");

    if (!email) found.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = "Enter a valid email address.";

    if (!enteredPassword) found.password = "Enter your password.";

    if (!isLogin) {
      const name = String(form.get("name") || "").trim();
      const phone = String(form.get("phone") || "").trim();

      if (name.length < 2) found.name = "Enter your full name.";
      if (enteredPassword && enteredPassword.length < 8) found.password = "Use at least 8 characters.";
      if (enteredPassword !== String(form.get("confirmPassword") || "")) {
        found.confirmPassword = "The two passwords do not match.";
      }
      if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) {
        found.phone = "Enter a valid phone number, or leave it blank.";
      }
    }

    return found;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const found = validate(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        await login(
          String(form.get("email") || "").trim(),
          String(form.get("password") || ""),
          form.get("remember") === "on"
        );
      } else {
        await register({
          name: String(form.get("name") || "").trim(),
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || ""),
          phone: String(form.get("phone") || "").trim() || undefined,
          role
        });
      }

      // replace() rather than push(): the back button should not return to a
      // sign-in form the user has already completed.
      router.replace(isLogin ? redirectTo : "/dashboard");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "We could not complete that request. Please try again.";

      // A duplicate email belongs against the email field, not in a banner.
      if (error instanceof ApiError && error.status === 409) setErrors({ email: message });
      else setErrors({ form: message });

      setLoading(false);
    }
  }

  return (
    <div>
      <p className="font-mono-ui text-xs font-medium uppercase tracking-[0.16em] text-brand">
        {isLogin ? "Welcome back" : "Create your account"}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
        {isLogin ? "Sign in to your hub." : "Join Excel Connect Hub."}
      </h2>
      <p className="mt-2.5 text-sm leading-6 text-muted">
        {isLogin
          ? "Your learning, opportunities and community, in one place."
          : "One account for learning, opportunities, community and support."}
      </p>

      <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
        {!isLogin && (
          <>
            <div>
              <label className="field-label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={`field ${errors.name ? "border-danger" : ""}`}
              />
              {errors.name && (
                <p id="name-error" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.name}
                </p>
              )}
            </div>

            <fieldset>
              <legend className="field-label">I am joining as</legend>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ value, label, icon: Icon, hint }) => {
                  const selected = role === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      aria-pressed={selected}
                      title={hint}
                      className={`focus-ring flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-all duration-200 ${
                        selected
                          ? "border-brand bg-brand/12 text-brand"
                          : "border-line bg-elevated text-muted hover:border-brand/50 hover:text-ink"
                      }`}
                    >
                      <Icon size={17} aria-hidden />
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}

        <div>
          <label className="field-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`field ${errors.email ? "border-danger" : ""}`}
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs font-medium text-danger">
              {errors.email}
            </p>
          )}
        </div>

        {!isLogin && (
          <div>
            <label className="field-label" htmlFor="phone">
              Phone number <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+255 700 000 000"
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
              className={`field ${errors.phone ? "border-danger" : ""}`}
            />
            {errors.phone ? (
              <p id="phone-error" className="mt-1.5 text-xs font-medium text-danger">
                {errors.phone}
              </p>
            ) : (
              <p id="phone-hint" className="mt-1.5 text-xs text-muted">
                Employers see this only on applications you send.
              </p>
            )}
          </div>
        )}

        <div>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            error={errors.password}
            onChange={(event) => !isLogin && setPassword(event.target.value)}
          />
          {!isLogin && <PasswordStrength password={password} />}
        </div>

        {!isLogin && (
          <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" error={errors.confirmPassword} />
        )}

        {isLogin && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input name="remember" type="checkbox" defaultChecked className="h-4 w-4 accent-[rgb(var(--primary))]" />
              Keep me signed in
            </label>
            <Link href="/forgot-password" className="focus-ring rounded text-sm font-bold text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
        )}

        {errors.form && (
          <p className="alert alert-error" role="alert">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
            <span>{errors.form}</span>
          </p>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary focus-ring w-full">
          {loading && <Loader2 className="animate-spin" size={17} aria-hidden />}
          {loading
            ? isLogin
              ? "Signing in…"
              : "Creating account…"
            : isLogin
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        {isLogin ? "New to Excel Connect Hub?" : "Already have an account?"}{" "}
        <Link href={isLogin ? "/signup" : "/login"} className="focus-ring rounded font-bold text-brand hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
