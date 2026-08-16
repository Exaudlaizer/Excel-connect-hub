"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName = "ember" | "aurora" | "emerald";
type ThemeContextValue = { theme: ThemeName; setTheme: (theme: ThemeName) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("ember");
  useEffect(() => {
    const saved = localStorage.getItem("excel_connect_theme") as ThemeName | null;
    if (saved && ["ember", "aurora", "emerald"].includes(saved)) setTheme(saved);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("excel_connect_theme", theme); }, [theme]);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
