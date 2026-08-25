"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Public site settings — the branding an anonymous visitor is allowed to see,
 * such as the background images an admin has uploaded.
 *
 * Cached for a few minutes: branding changes rarely, and the login page should
 * not make a network request every render. A failure is swallowed to an empty
 * object so a settings outage never blocks a page from rendering.
 */
type PublicSettings = {
  authBackground?: { url?: string };
  landingBackground?: { url?: string };
};

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => api<{ settings: PublicSettings }>("/settings/public"),
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  return query.data?.settings || {};
}
