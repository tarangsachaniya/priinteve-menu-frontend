import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // This app has no Geist — it's entirely the restaurant product, so
        // the base "sans" utility is DM Sans/Outfit, not Cards' Geist.
        sans: ["var(--font-dm-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-outfit)", ...defaultTheme.fontFamily.sans],
        // Instrument Serif italic, loaded by lib/marketing/fonts.ts and applied
        // only on the marketing wrapper. Off that page the variable is unset
        // and this falls through to the platform serif — nothing on the
        // console uses font-serif, so that fallback is never rendered.
        serif: ["var(--font-instrument-serif)", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "oklch(var(--ink) / <alpha-value>)",
          muted: "oklch(var(--ink-muted) / <alpha-value>)",
        },
        // Marketing-page-only accents. Defined here so the landing page can use
        // plain utilities, but the variables behind them only exist inside
        // [data-marketing] (app/marketing-theme.css) — using these classes
        // anywhere else resolves to nothing, which is the intended guard rail.
        mint: {
          DEFAULT: "oklch(var(--mint) / <alpha-value>)",
          ink: "oklch(var(--mint-ink) / <alpha-value>)",
        },
        clay: "oklch(var(--clay) / <alpha-value>)",
        hairline: "oklch(var(--hairline) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        /**
         * A number arriving on the pickup board. Scale plus a brightening ring,
         * because a guest is watching that wall from across a room and out of
         * the corner of their eye — colour alone at that distance reads as
         * nothing at all.
         *
         * This is the PRIMARY signal, not a garnish on the chime. A display
         * whose audio was never unlocked, or whose room is deliberately quiet,
         * still has to announce a ready order.
         */
        "ready-flash": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 oklch(var(--primary) / 0)" },
          "50%": { transform: "scale(1.03)", boxShadow: "0 0 0 6px oklch(var(--primary) / 0.45)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        // Three cycles, ~2.7s total: long enough to catch someone mid-glance,
        // short enough that a busy board is not permanently in motion.
        "ready-flash": "ready-flash 0.9s ease-in-out 3",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
