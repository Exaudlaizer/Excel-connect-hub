"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Settings } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { ApiError, api } from "@/lib/api";
import { AuthUser, useAuth } from "@/lib/auth";

/**
 * Profile.
 *
 * The fields shown depend on the account's role: an employer has no graduation
 * year and a student has no industry. Values are seeded from the account so the
 * form always shows what is currently stored rather than starting blank and
 * silently wiping fields on save.
 */

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  hint
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="field"
      />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, applyUser, needsProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<{ user: AuthUser }>("/users/me", { method: "PATCH", token, body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      setError("");
      setSaved(true);
      applyUser(data.user);
      setTimeout(() => setSaved(false), 3500);
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "We could not save your profile. Please try again.")
  });

  function csv(value: FormDataEntryValue | null) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function buildProfile(form: FormData) {
    const text = (key: string) => String(form.get(key) || "").trim();

    if (user?.role === "company") {
      return {
        companyProfile: {
          companyName: text("companyName"),
          industry: text("industry"),
          website: text("website"),
          location: text("location"),
          description: text("description")
        }
      };
    }

    if (user?.role === "mentor") {
      return {
        mentorProfile: {
          expertise: text("expertise"),
          organization: text("organization"),
          yearsExperience: Number(form.get("yearsExperience") || 0),
          website: text("website"),
          location: text("location"),
          topics: csv(form.get("topics")),
          bio: text("bio")
        }
      };
    }

    return {
      studentProfile: {
        university: text("university"),
        program: text("program"),
        graduationYear: Number(form.get("graduationYear") || 0),
        location: text("location"),
        skills: csv(form.get("skills")),
        cvUrl: text("cvUrl"),
        bio: text("bio")
      }
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();

    if (name.length < 2) return setError("Enter your full name.");
    if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) {
      return setError("Enter a valid phone number, or leave it blank.");
    }

    setError("");
    update.mutate({ name, phone: phone || null, ...buildProfile(form) });
  }

  const isCompany = user?.role === "company";
  const isMentor = user?.role === "mentor";
  const student = user?.studentProfile;
  const company = user?.companyProfile;
  const mentor = user?.mentorProfile;

  return (
    <Shell>
      <SectionHeader
        title="Profile"
        subtitle={
          isCompany
            ? "Your company details appear on every opportunity you post."
            : isMentor
              ? "Your expertise appears alongside every course you publish."
              : "Employers read this when you apply, so keep it current."
        }
        action={
          <Link href="/settings" className="btn btn-secondary focus-ring">
            <Settings size={16} aria-hidden /> Settings
          </Link>
        }
      />

      {needsProfile && (
        <p className="alert alert-info mb-6" role="status">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {isCompany
              ? "Add your company name so students know who is hiring."
              : isMentor
                ? "Add your expertise so students know what you teach."
                : "Add your university and programme to complete your profile."}
          </span>
        </p>
      )}

      <form onSubmit={submit} className="card card-pad max-w-2xl">
        <div className="space-y-4">
          <Field label="Full name" name="name" defaultValue={user?.name} />
          <Field
            label="Phone number"
            name="phone"
            type="tel"
            defaultValue={user?.phone || ""}
            placeholder="+255 700 000 000"
          />

          {isCompany && (
            <>
              <Field label="Company name" name="companyName" defaultValue={company?.companyName} />
              <Field label="Industry" name="industry" defaultValue={company?.industry} />
              <Field label="Website" name="website" type="url" defaultValue={company?.website} />
            </>
          )}

          {isMentor && (
            <>
              <Field
                label="Your expertise"
                name="expertise"
                defaultValue={mentor?.expertise}
                placeholder="Software engineering"
              />
              <Field label="Organization" name="organization" defaultValue={mentor?.organization} placeholder="Independent" />
              <Field
                label="Years of experience"
                name="yearsExperience"
                type="number"
                defaultValue={mentor?.yearsExperience}
              />
              <Field
                label="Topics you teach"
                name="topics"
                defaultValue={mentor?.topics?.join(", ")}
                hint="Separate each topic with a comma."
              />
              <Field label="Website or portfolio" name="website" type="url" defaultValue={mentor?.website} />
            </>
          )}

          {!isCompany && !isMentor && (
            <>
              <Field label="University" name="university" defaultValue={student?.university} />
              <Field label="Programme" name="program" defaultValue={student?.program} />
              <Field label="Graduation year" name="graduationYear" type="number" defaultValue={student?.graduationYear} />
              <Field
                label="Skills"
                name="skills"
                defaultValue={student?.skills?.join(", ")}
                hint="Separate each skill with a comma."
              />
              <Field
                label="CV link"
                name="cvUrl"
                type="url"
                defaultValue={student?.cvUrl}
                hint="Employers open this from your application."
              />
            </>
          )}

          <Field
            label="Location"
            name="location"
            defaultValue={isCompany ? company?.location : isMentor ? mentor?.location : student?.location}
          />

          <div>
            <label className="field-label" htmlFor={isCompany ? "description" : "bio"}>
              {isCompany ? "About the company" : "About you"}
            </label>
            <textarea
              id={isCompany ? "description" : "bio"}
              name={isCompany ? "description" : "bio"}
              rows={5}
              defaultValue={isCompany ? company?.description : isMentor ? mentor?.bio : student?.bio}
              className="field"
            />
          </div>
        </div>

        {error && (
          <p className="alert alert-error mt-5" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        {saved && (
          <p className="alert alert-success mt-5" role="status">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>Your profile has been saved.</span>
          </p>
        )}

        <button type="submit" disabled={update.isPending} className="btn btn-primary focus-ring mt-6">
          {update.isPending && <Loader2 className="animate-spin" size={16} aria-hidden />}
          {update.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </Shell>
  );
}
