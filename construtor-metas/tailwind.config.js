/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff', 100: '#dbe6fe', 200: '#bfd3fe', 300: '#93b4fd', 400: '#608bfa',
          500: '#3b66f5', 600: '#2549ea', 700: '#1d37d7', 800: '#1e2fae', 900: '#1e2d89',
        },
      },
    },
  },
  plugins: [],
};
