"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, useTheme } from "@/components/ThemeProvider";

/**
 * Compact theme picker for pages outside the signed-in shell.
 *
 * Signed-in users change their theme in Settings, where the choice is saved to
 * their account. This exists so a visitor on the landing page can still read the
 * site in the palette they prefer; the choice is kept locally and adopted by
 * their account when they sign in.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = THEMES.find((item) => item.id === theme);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change theme, currently ${active?.name ?? "default"}`}
        className="focus-ring flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-muted transition-colors hover:bg-secondary hover:text-ink"
      >
        <Palette size={15} aria-hidden />
        <span className="hidden text-xs font-bold sm:inline">{active?.name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="glass animate-fade-in absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl shadow-lift"
        >
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === item.id}
              onClick={() => {
                setTheme(item.id);
                setOpen(false);
              }}
              className="focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary"
            >
              <span className="flex shrink-0 gap-0.5" aria-hidden>
                {item.swatch.map((colour) => (
                  <i
                    key={colour}
                    className="block h-3.5 w-2 rounded-sm border border-line"
                    style={{ backgroundColor: colour }}
                  />
                ))}
              </span>
              <span className="flex-1 text-sm font-semibold text-ink">{item.name}</span>
              {theme === item.id && <Check size={14} className="shrink-0 text-brand" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
