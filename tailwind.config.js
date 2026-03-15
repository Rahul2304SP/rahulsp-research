/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f8f9fa",
        "surface-2": "#f3f4f6",
        border: "#e5e7eb",
        "text-primary": "#1a1a2e",
        "text-secondary": "#374151",
        "text-muted": "#6b7280",
        accent: "#1e40af",
        "accent-light": "#3b82f6",
        "chart-up": "#059669",
        "chart-down": "#dc2626",
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"Instrument Serif"', '"Georgia"', 'serif'],
      },
    },
  },
  plugins: [],
};
