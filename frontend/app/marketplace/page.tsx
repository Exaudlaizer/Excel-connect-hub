"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { SectionHeader } from "@/components/SectionHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Ad = { _id: string; title: string; category: string; description: string; price?: number; contact: string; location?: string };

export default function MarketplacePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const { data } = useQuery({ queryKey: ["ads", category], queryFn: () => api<{ ads: Ad[] }>(`/ads${category ? `?category=${category}` : ""}`) });
  const createAd = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api("/ads", { method: "POST", token, body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] })
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createAd.mutate({
      title: form.get("title"),
      category: form.get("category"),
      description: form.get("description"),
      price: Number(form.get("price") || 0),
      contact: form.get("contact"),
      location: form.get("location")
    });
    event.currentTarget.reset();
  }

  return (
    <Shell>
      <SectionHeader title="Marketplace" subtitle="Youth ventures and small businesses can advertise services, products, events, and campus offers." />
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "technology", "food", "fashion", "events", "services", "housing", "other"].map((item) => (
          <button key={item || "all"} onClick={() => setCategory(item)} className={`rounded-md px-3 py-2 text-sm font-semibold ${category === item ? "bg-brand text-night" : "bg-white text-slate-600"}`}>
            {item || "all"}
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {data?.ads?.map((ad) => (
            <article key={ad._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <span className="rounded bg-orange-50 px-2 py-1 text-xs font-semibold uppercase text-accent">{ad.category}</span>
              <h2 className="mt-3 text-lg font-bold text-ink">{ad.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{ad.description}</p>
              <p className="mt-3 text-sm font-semibold text-ink">{ad.price ? `TZS ${ad.price.toLocaleString()}` : "Contact for price"}</p>
              <p className="mt-1 text-sm text-muted">{ad.contact}{ad.location ? ` · ${ad.location}` : ""}</p>
            </article>
          ))}
        </div>
        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-ink">Post advertisement</h2>
          <input name="title" placeholder="Title" className="focus-ring mt-4 w-full rounded-md border border-slate-300 px-3 py-2" required />
          <select name="category" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2">
            {["technology", "food", "fashion", "events", "services", "housing", "other"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <textarea name="description" placeholder="Description" rows={4} className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
          <input name="price" type="number" placeholder="Price in TZS" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
          <input name="contact" placeholder="Contact" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" required />
          <input name="location" placeholder="Location" className="focus-ring mt-3 w-full rounded-md border border-slate-300 px-3 py-2" />
          <button className="focus-ring mt-3 w-full rounded-md bg-brand px-4 py-2 font-semibold text-night">Submit for approval</button>
        </form>
      </div>
    </Shell>
  );
}
