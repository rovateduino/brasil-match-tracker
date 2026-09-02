/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0a1128',
        slate: '#1e293b',
        'soft-gray': '#f1f5f9',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        'card-bg': '#ffffff',
        'card-border': '#e2e8f0',
        'text-primary': '#0f172a',
        'text-secondary': '#475569',
        'live-dot': '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      lineHeight: {
        relaxed: '1.6',
      },
      borderRadius: {
        card: '8px',
      },
      borderWidth: {
        card: '1px',
      },
    },
  },
  plugins: [],
};