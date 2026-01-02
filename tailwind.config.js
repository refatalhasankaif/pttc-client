/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        military: {
          900: '#0d1117',
          800: '#1a1f2e',
          700: '#2d3436',
          600: '#3d4450',
          500: '#4a5568',
          400: '#576574',
          accent: '#2ecc71',
          danger: '#e74c3c',
          warning: '#f39c12',
        },
      },
      keyframes: {
        wave1: {
          '0%, 100%': { transform: 'scaleY(0.5)', opacity: '1' },
          '50%': { transform: 'scaleY(1)', opacity: '0.7' },
        },
        wave2: {
          '0%, 100%': { transform: 'scaleY(0.3)', opacity: '0.5' },
          '50%': { transform: 'scaleY(0.8)', opacity: '0.3' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        scan: {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(10px)', opacity: '0' },
        },
      },
      animation: {
        'wave1': 'wave1 0.5s ease-in-out infinite',
        'wave2': 'wave2 0.6s ease-in-out infinite',
        'wave3': 'wave1 0.7s ease-in-out infinite',
        'scan': 'scan 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
