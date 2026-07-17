"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { user, token } = useAuth();
  const [message, setMessage] = useState("");
  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api("/users/me", { method: "PATCH", token, body: JSON.stringify(payload) }),
    onSuccess: () => setMessage("Profile saved.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile =
      user?.role === "company"
        ? {
            companyProfile: {
              companyName: form.get("companyName"),
              industry: form.get("industry"),
              website: form.get("website"),
              phone: form.get("phone"),
              location: form.get("location"),
              description: form.get("description")
            }
          }
        : {
            studentProfile: {
              university: form.get("university"),
              program: form.get("program"),
              graduationYear: Number(form.get("graduationYear") || 0),
              phone: form.get("phone"),
              location: form.get("location"),
              skills: String(form.get("skills") || "").split(",").map((skill) => skill.trim()).filter(Boolean),
              cvUrl: form.get("cvUrl"),
              bio: form.get("bio")
            }
          };
    update.mutate({ name: form.get("name"), ...profile });
  }

  return (
    <Shell>
      <SectionHeader title="Profile" subtitle="Keep your CV details or company profile ready for applications, recruiting, and marketplace trust." />
      {message && <p className="mb-4 rounded-md bg-brand/10 px-4 py-3 text-sm text-brand">{message}</p>}
      <form onSubmit={submit} className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <input name="name" defaultValue={user?.name} placeholder="Name" className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2" required />
        {user?.role === "company" ? (
          <>
            <input name="companyName" placeholder="Company name" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="industry" placeholder="Industry" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="website" placeholder="Website" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
          </>
        ) : (
          <>
            <input name="university" placeholder="University" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="program" placeholder="Program" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="graduationYear" type="number" placeholder="Graduation year" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="skills" placeholder="Skills, comma separated" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
            <input name="cvUrl" placeholder="CV URL" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
          </>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="phone" placeholder="Phone" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
          <input name="location" placeholder="Location" className="focus-ring rounded-md border border-slate-300 px-3 py-2" />
        </div>
        <textarea name={user?.role === "company" ? "description" : "bio"} placeholder="About" rows={5} className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
        <button className="focus-ring mt-3 rounded-md bg-brand px-4 py-2 font-semibold text-night">Save profile</button>
      </form>
    </Shell>
  );
}
