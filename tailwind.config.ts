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
        income: 'rgb(34, 197, 94)',
        expense: 'rgb(239, 68, 68)',
        other: 'rgb(96, 165, 250)',
      },
    },
  },
  plugins: [],
};
export default config;

