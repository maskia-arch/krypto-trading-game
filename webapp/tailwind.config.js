/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        deep: '#06080f',
        card: '#0c1019',
        surface: '#151c2c',
        neon: {
          green: '#22d68a',
          red: '#f43f5e',
          blue: '#38bdf8',
          gold: '#fbbf24',
          purple: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
}
