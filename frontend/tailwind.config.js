/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#aecbfa',
          300: '#8ab4f8',
          400: '#669df6',
          500: '#4285f4',
          600: '#1a73e8', // Google Maps Primary Blue
          700: '#1967d2',
          800: '#185abc',
          900: '#174ea6',
          950: '#0d2d6c'
        },
        gmap: {
          bg: '#f8f9fa',
          surface: '#ffffff',
          border: '#e0e3e7',
          'border-light': '#dadce0',
          text: '#202124',
          'text-secondary': '#5f6368',
          'text-muted': '#80868b',
          blue: '#1a73e8',
          'blue-hover': '#1557d0',
          'blue-light': '#e8f0fe',
          green: '#1e8e3e',
          'green-light': '#e6f4ea',
          yellow: '#f9ab00',
          'yellow-light': '#fef7e0',
          red: '#d93025',
          'red-light': '#fce8e6'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Outfit', 'Inter', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Plus Jakarta Sans', '-apple-system', 'sans-serif']
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'radar': 'radar 2s linear infinite'
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
