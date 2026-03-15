/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#09090b",
        surface: "#111113",
        "surface-2": "#18181b",
        border: "#27272a",
        "text-primary": "#fafafa",
        "text-secondary": "#a1a1aa",
        "text-muted": "#71717a",
        accent: "#22c55e",
        "accent-dim": "#16a34a",
        "chart-up": "#22c55e",
        "chart-down": "#ef4444",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        serif: ['"Instrument Serif"', '"Georgia"', "serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "#a1a1aa",
            "--tw-prose-headings": "#fafafa",
            "--tw-prose-links": "#22c55e",
            "--tw-prose-bold": "#fafafa",
            "--tw-prose-code": "#fafafa",
            "--tw-prose-quotes": "#a1a1aa",
            "--tw-prose-quote-borders": "#27272a",
            "--tw-prose-counters": "#71717a",
            "--tw-prose-bullets": "#71717a",
            "--tw-prose-hr": "#27272a",
            "--tw-prose-th-borders": "#27272a",
            "--tw-prose-td-borders": "#27272a",
          },
        },
      },
    },
  },
  plugins: [],
};
