import type { Config } from "tailwindcss";

// Tailwind scans app/ and components/ for class names so styles are generated on demand.
const config: Config = {
  // Theme is driven by a `dark` class on <html>, toggled by ThemeToggle and
  // restored before paint by the inline script in app/layout.tsx.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Shared semantic color tokens so the palette stays consistent across the
      // app. Values are CSS variables defined in app/globals.css, which lets the
      // light/dark swap happen in a single place.
      colors: {
        app: "rgb(var(--app-bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        // Premium dark auth palette. Only used by the authentication screens, so
        // it cannot leak into the light app shell. Fixed brand colours rather
        // than theme-swapped tokens, hence literal hex values.
        navy: {
          950: "#080F22",
          900: "#0B1229",
          800: "#101A35",
          700: "#16234A",
        },
        brand: {
          300: "#B4AFFF",
          400: "#958DFF",
          500: "#7468FF",
          600: "#6153F5",
        },
        electric: {
          400: "#7FB0FF",
          500: "#5595FF",
        },
        // Dashboard redesign palette (dark theme constants).
        indigo2: "rgb(var(--df-violet) / <alpha-value>)",
        blue2: "rgb(var(--df-blue) / <alpha-value>)",
        green2: "rgb(var(--df-green) / <alpha-value>)",
        red2: "rgb(var(--df-red) / <alpha-value>)",
        card2: "rgb(var(--df-card-2) / <alpha-value>)",
      },
      // Consistent height for the top bar and mobile bottom nav.
      spacing: {
        18: "4.5rem",
      },
      boxShadow: {
        // Soft, wide glow used behind the hero and under the auth card.
        glow: "0 0 80px -20px rgba(116, 104, 255, 0.55)",
        card: "0 24px 60px -20px rgba(4, 8, 24, 0.85)",
      },
      keyframes: {
        // Slow vertical drift for the floating dashboard preview.
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        // Gentle glow pulse for the ambient light behind the preview.
        pulseGlow: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "pulse-glow": "pulseGlow 6s ease-in-out infinite",
      },
      fontFamily: {
        // Inter first, then the platform UI stack: no extra font download, and
        // Inter is used when the OS already has it.
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
