/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Paleta del prototipo (reference/quiz-prototype.html)
      colors: {
        bg: { DEFAULT: "#141311", 2: "#1c1a17" },
        paper: "#201e1b",
        ink: { DEFAULT: "#ece7de", dim: "#a9a297" },
        line: "#38352f",
        accent: { DEFAULT: "#9a3324", soft: "#c96a54", hover: "#832c1f" },
        ok: { DEFAULT: "#4c7a5b", soft: "#7ea987" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "serif"],
      },
      // Coach: el turno anterior "se quema" y deja un rescoldo antes del siguiente
      keyframes: {
        burn: {
          "0%": { opacity: "1", filter: "none", transform: "translateY(0)" },
          "35%": {
            opacity: "0.9",
            filter: "sepia(1) saturate(4) hue-rotate(-40deg) brightness(0.95) blur(0.5px)",
          },
          "100%": {
            opacity: "0",
            filter: "sepia(1) saturate(3) hue-rotate(-40deg) brightness(0.2) blur(6px)",
            transform: "translateY(-10px) scale(0.98)",
          },
        },
        ember: {
          "0%": { opacity: "0", transform: "scaleX(0.6)" },
          "30%": { opacity: "1", transform: "scaleX(1)" },
          "100%": { opacity: "0", transform: "scaleX(1)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        burn: "burn 700ms ease-in forwards",
        ember: "ember 300ms ease-out forwards",
        rise: "rise 350ms ease-out",
      },
    },
  },
  plugins: [],
};
