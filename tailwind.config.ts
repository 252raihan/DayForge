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
      },
      // Consistent height for the top bar and mobile bottom nav.
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
