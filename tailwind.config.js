/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: { brand: { 50: '#e9f6ff', 100: '#cceafa', 500: '#1879db', 600: '#1266c0', 700: '#104e94' } },
    },
  },
  plugins: [],
};
