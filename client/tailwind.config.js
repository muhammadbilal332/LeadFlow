/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Deep navy identity color: page headings, the sidebar wordmark, the
        // hero section and any "major feature section" surface. Kept
        // separate from `brand` (the bright blue used for buttons, CTAs and
        // active states) the same way the reference pairs a deep navy for
        // identity with a brighter blue for action — 900/950 are the exact
        // "Primary Navy" / "Deep Navy" tones from that reference, with a
        // full ramp derived around them for borders, tints and hovers.
        navy: {
          50: '#eaf1fb',
          100: '#d2e0f4',
          200: '#a6c2e9',
          300: '#79a3de',
          400: '#4c84d3',
          500: '#3566b0',
          600: '#234a8a',
          700: '#163a74',
          800: '#0c305f',
          900: '#082f73',
          950: '#06265f',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)',
        'card-hover': '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 12px 32px -8px rgb(15 23 42 / 0.14)',
        // The spec's "Blue Glow" — a soft blue halo for focus/hover accents,
        // used sparingly (buttons, cards) rather than as a default shadow.
        glow: '0 0 0 3px rgba(59, 130, 246, 0.18)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
