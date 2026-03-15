import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark medical futuristic palette
        cardio: {
          950: '#060e1a',
          900: '#0a1628',
          800: '#0f2035',
          700: '#142d48',
          600: '#1a3a5c',
          500: '#1f4a73',
          400: '#2a6090',
          300: '#3b82b0',
          200: '#60a0d0',
          100: '#a0c8e8',
          50: '#dceefb',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
        // Legacy primary mapping (for gradual migration)
        primary: {
          50: '#dceefb',
          100: '#a0c8e8',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        risk: {
          low: '#22c55e',
          moderate: '#f59e0b',
          high: '#ef4444',
          critical: '#dc2626',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-in-out',
        'page-enter': 'page-enter 0.4s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(6, 182, 212, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
