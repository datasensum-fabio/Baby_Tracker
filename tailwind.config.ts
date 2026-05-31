import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        feed: { light: "#DBEAFE", DEFAULT: "#3B82F6", dark: "#1D4ED8" },
        sleep: { light: "#EDE9FE", DEFAULT: "#8B5CF6", dark: "#5B21B6" },
        medication: { light: "#FEE2E2", DEFAULT: "#EF4444", dark: "#B91C1C" },
        nappy: { light: "#FEF3C7", DEFAULT: "#F59E0B", dark: "#B45309" },
      },
    },
  },
  plugins: [],
};

export default config;
