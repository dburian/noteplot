/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      boxShadow: {
        'hover': '0px -5px 10px 0px rgba(0, 0, 0, 0.5)'
      },
      colors: {
        'invert-white': '#d1d5db'
      }
    },
  },
  plugins: [require('@tailwindcss/typography'),],
}

