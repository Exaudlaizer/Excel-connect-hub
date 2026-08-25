"use client";

import { useSiteSettings } from "@/lib/siteSettings";

/**
 * The landing hero's optional background image.
 *
 * Rendered as an absolutely-positioned layer so the server-rendered hero content
 * sits on top of it untouched. When no image is set it renders nothing, and the
 * hero keeps its plain surface — the image never becomes a requirement.
 */
export function SiteHeroBackground() {
  const settings = useSiteSettings();
  const url = settings.landingBackground?.url;
  if (!url) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage: `linear-gradient(180deg, rgb(var(--background) / 0.72), rgb(var(--background) / 0.92)), url("${url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    />
  );
}
