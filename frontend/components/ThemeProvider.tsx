"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName = "midnight" | "light" | "ocean" | "forest";

export const THEMES: Array<{ id: ThemeName; name: string; description: string; swatch: [string, string, string] }> = [
  {
    id: "midnight",
    name: "Midnight",
    description: "Charcoal surfaces with a warm gold accent.",
    swatch: ["#0b0d11", "#14171d", "#f0a03c"]
  },
  {
    id: "light",
    name: "Light",
    description: "White and light grey with dark text.",
    swatch: ["#f6f7fa", "#ffffff", "#b07c20"]
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep navy with a cool cyan accent.",
    swatch: ["#071018", "#0e1c27", "#38bde0"]
  },
  {
    id: "forest",
    name: "Forest",
    description: "Dark green with a warm amber accent.",
    swatch: ["#08120d", "#101f17", "#e0a940"]
  }
];

export const THEME_STORAGE_KEY = "excel_connect_theme";
export const DEFAULT_THEME: ThemeName = "midnight";

const THEME_IDS = THEMES.map((theme) => theme.id);

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeName);
}

/**
 * Runs before first paint, injected into <head> by the root layout.
 *
 * Without it the page paints the default theme and then swaps once React
 * hydrates, which is a visible flash of the wrong colours on every load. Reading
 * localStorage synchronously here is the only way to avoid that.
 */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var allowed=${JSON.stringify(
  THEME_IDS
)};document.documentElement.setAttribute("data-theme",allowed.indexOf(t)>-1?t:"${DEFAULT_THEME}");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`;

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  /** Adopt a theme that came from the server without echoing it straight back. */
  adoptRemoteTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialised from the attribute the bootstrap script already set, so the
  // first React render agrees with what is on screen.
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof document === "undefined") return DEFAULT_THEME;
    const applied = document.documentElement.getAttribute("data-theme");
    return isThemeName(applied) ? applied : DEFAULT_THEME;
  });

  const apply = useCallback((next: ThemeName) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing with storage disabled: the theme still applies for
      // this session, it just will not survive a reload.
    }
  }, []);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      apply(next);
    },
    [apply]
  );

  // Same as setTheme from the UI's point of view. It exists as a separate entry
  // point so the auth layer can push the account's saved theme in without the
  // sync effect immediately writing that value back to the server.
  const adoptRemoteTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      apply(next);
    },
    [apply]
  );

  // Keeps other tabs in step: changing the theme in one tab updates the rest.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY && isThemeName(event.newValue)) {
        setThemeState(event.newValue);
        document.documentElement.setAttribute("data-theme", event.newValue);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, adoptRemoteTheme }), [theme, setTheme, adoptRemoteTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
