/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf5",
          100: "#d6f5e7",
          200: "#afeace",
          300: "#7bd8b0",
          400: "#45be8d",
          500: "#22a271",
          600: "#15825a",
          700: "#0b6b47",
          800: "#09553a",
          900: "#074630",
          950: "#03291c",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
