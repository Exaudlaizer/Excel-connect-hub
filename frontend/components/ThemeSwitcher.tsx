"use client";

import { Palette } from "lucide-react";
import { ThemeName, useTheme } from "@/components/ThemeProvider";

const choices: Array<{ id: ThemeName; name: string; dots: string }> = [
  { id: "ember", name: "Ember", dots: "#ff5a1f,#e53935,#ffb74d" },
  { id: "aurora", name: "Aurora", dots: "#4f7cff,#8b5cf6,#22d3ee" },
  { id: "emerald", name: "Emerald", dots: "#10b981,#0d9488,#a3e635" }
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return <div className="theme-switcher"><Palette size={15} aria-hidden /><span className="sr-only">Choose colour theme</span>{choices.map((choice) => <button key={choice.id} aria-label={`Use ${choice.name} theme`} aria-pressed={theme === choice.id} onClick={() => setTheme(choice.id)} className={`theme-choice ${theme === choice.id ? "theme-choice-active" : ""}`}><span className="theme-dots">{choice.dots.split(",").map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span><span className="hidden xl:inline">{choice.name}</span></button>)}</div>;
}
