/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        fxr: {
          bg: '#080A0F',
          card: '#0F131C',
          cardHover: '#161C2A',
          border: '#1E2638',
          borderLight: '#2D374D',
          primary: '#2563EB',
          primaryHover: '#1D4ED8',
          accent: '#00D26A',
          accentHover: '#00B85C',
          danger: '#F93958',
          text: '#F8FAFC',
          muted: '#94A3B8',
          subtle: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
