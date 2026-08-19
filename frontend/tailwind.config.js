/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#050507',
          900: '#070709',
          850: '#0B0B0F',
          800: '#12121A',
          700: '#1E1E2A',
        },
        violet: {
          neon: '#8B5CF6',
          dark: '#5B21B6',
        },
        amber: {
          gold: '#F59E0B',
          warm: '#D97706',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'radar-ping': 'radarPing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', filter: 'drop-shadow(0 0 15px rgba(139, 92, 246, 0.5))' },
          '50%': { opacity: '0.9', filter: 'drop-shadow(0 0 35px rgba(139, 92, 246, 0.9))' },
        },
        radarPing: {
          '75%, 100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
