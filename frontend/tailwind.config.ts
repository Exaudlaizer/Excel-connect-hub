import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Excel Smartic — light theme with a gold accent (from the logo)
        ink: "#1b2130", // primary text / headings
        muted: "#64748b", // secondary text
        brand: "#b7862b", // gold (primary accent)
        brandDark: "#8a6412", // deep gold for hovers
        accent: "#d97706", // amber highlight
        surface: "#f7f8fb", // app background
        card: "#ffffff", // panels / cards
        line: "#e6e8ee", // subtle borders
        night: "#14171f" // dark text used on gold buttons
      },
      boxShadow: {
        soft: "0 12px 40px rgba(24, 33, 47, 0.08)",
        gold: "0 10px 30px rgba(183, 134, 43, 0.25)"
      },
      backgroundImage: {
        gold: "linear-gradient(135deg, #f6e3a1 0%, #d9a441 45%, #8a5a12 100%)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "slide-up": "slide-up 0.5s ease-out both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
