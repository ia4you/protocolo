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
    },
  },
  plugins: [],
};
