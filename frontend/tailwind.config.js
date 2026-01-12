/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        primary: "#0EA5E9",     // blue accent
        secondary: "#FF6B00",   // orange
        darkBg: "#0B0F19",      // dark surface
      },
    },
  },
  plugins: [],
};
