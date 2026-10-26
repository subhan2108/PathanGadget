/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 38 25% 85%))",
        input: "hsl(var(--input, 38 25% 85%))",
        ring: "hsl(var(--ring, 43 90% 48%))",
        background: "hsl(var(--background, 43 56% 96%))",
        foreground: "hsl(var(--foreground, 28 20% 10%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 43 85% 48%))",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 38 35% 93%))",
          foreground: "hsl(var(--secondary-foreground, 28 20% 15%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0 84.2% 60.2%))",
          foreground: "hsl(var(--destructive-foreground, 0 0% 98%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 38 35% 93%))",
          foreground: "hsl(var(--muted-foreground, 28 15% 45%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 43 90% 55%))",
          foreground: "hsl(var(--accent-foreground, 28 20% 10%))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover, 0 0% 100%))",
          foreground: "hsl(var(--popover-foreground, 28 20% 10%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground, 28 20% 10%))",
        },
      },
      backgroundImage: {
        "gradient-conic": "conic-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
}
