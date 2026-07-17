"use client";

import { useState } from "react";

/**
 * Excel Smartic brand mark.
 *
 * Renders the real uploaded logo from `frontend/public/logo.png`.
 * >>> Save your uploaded image there as `logo.png` <<<
 *
 * Until that file exists it shows a small gold "ES" fallback so the layout
 * never breaks. The logo art already has its own black background, so it sits
 * on a rounded dark tile to look intentional on the light UI.
 */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-lg bg-night font-serif font-bold text-brand ${className}`}
      >
        ES
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Excel Smartic"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-lg object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
