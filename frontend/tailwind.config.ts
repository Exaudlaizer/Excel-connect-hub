import type { Config } from "tailwindcss";

/**
 * Every colour here points at a CSS variable defined in app/globals.css.
 *
 * Nothing in this file is a literal hex value, which is what makes the four
 * themes work: changing data-theme on the root element re-points every one of
 * these tokens at once, and no component has to know a theme exists.
 *
 * The channel-triplet form (`rgb(var(--x) / <alpha-value>)`) is required so
 * opacity modifiers such as `bg-brand/10` and `border-line/60` keep working.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic names, matching the token vocabulary.
        background: token("background"),
        foreground: token("foreground"),
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          soft: token("primary-soft"),
          strong: token("primary-strong")
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground")
        },
        elevated: token("elevated"),
        success: token("success"),
        successSurface: token("success-surface"),
        danger: token("danger"),
        dangerSurface: token("danger-surface"),
        info: token("info"),
        infoSurface: token("info-surface"),
        warning: token("warning"),
        warningSurface: token("warning-surface"),

        // The vocabulary the existing pages already use, re-pointed at tokens so
        // they inherit theming without being rewritten.
        ink: token("foreground"),
        muted: token("muted"),
        brand: token("primary"),
        brandLight: token("primary-soft"),
        brandDark: token("primary-strong"),
        accent: token("accent"),
        surface: token("background"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground")
        },
        line: token("border"),
        night: token("primary-foreground")
      },
      borderColor: {
        DEFAULT: token("border")
      },
      ringColor: {
        DEFAULT: token("ring")
      },
      boxShadow: {
        soft: "var(--shadow-card)",
        lift: "var(--shadow-lift)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.32s ease both",
        "fade-rise": "fade-rise 0.42s cubic-bezier(0.22, 0.7, 0.25, 1) both",
        float: "float 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
