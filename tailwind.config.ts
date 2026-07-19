import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",       // deep navy - authority, headers
        paper: "#EDEEE7",     // stone-gray paper background
        paperDark: "#E1E2D9",
        oxblood: "#8C2F39",   // seal-red accent, official stamps
        brass: "#B08D57",     // brass/gold accent, secondary
        moss: "#3D5A3D",      // status-positive (erledigt/genehmigt)
        ash: "#5B5F5A",       // muted body text on paper
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        stamp: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
