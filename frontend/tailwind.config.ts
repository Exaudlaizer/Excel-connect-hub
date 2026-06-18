import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        muted: "#607089",
        brand: "#0f766e",
        accent: "#d97706",
        surface: "#f7f9fc"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(24, 33, 47, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
