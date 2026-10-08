/**
 * Acme Backtest design tokens — single source of truth for the UI palette.
 *
 * "Acme Backtest" is a fictional brand for this demo. Token names follow a
 * semantic layer (brand / surface / line / ink / system) so components never
 * reference raw hex — change a value here and the whole UI follows.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // ── Brand ────────────────────────────────────────────────────────────
        brand: {
          DEFAULT: '#7C3AED', // primary CTA, active states → violet-600
          hover: '#6D28D9', //   primary hover → violet-700
          pressed: '#5B21B6', // primary pressed → violet-800
          light: '#A78BFA', //   accent text on dark ground → violet-400
        },

        // ── Surfaces ─────────────────────────────────────────────────────────
        surface: {
          DEFAULT: '#030303', // bg-primary / card-bg-primary → dark-900
          raised: '#0A0A0A', //  bg-secondary                 → dark-800
          inset: '#1A1A1A', //   bg-tertiary / card-bg-secondary → dark-700
          hover: '#2A2A2A', //   card-bg-secondary-hover      → dark-600
        },

        // ── Borders ──────────────────────────────────────────────────────────
        line: {
          DEFAULT: '#1A1A1A', // border-primary   → dark-700
          strong: '#2A2A2A', //  border-secondary → dark-600
          strongest: '#3A3A3A', // border-tertiary → dark-500
        },

        // ── Text / icons ─────────────────────────────────────────────────────
        ink: {
          DEFAULT: '#F6F6F6', // text-primary / icon-primary   → neutral-50
          muted: '#D1D1D1', //   text-secondary / icon-secondary → neutral-200
          subtle: '#888888', //  text-disabled                 → neutral-400
        },

        // ── System ───────────────────────────────────────────────────────────
        success: {
          DEFAULT: '#53B483',
          light: '#D9F9E6',
          dark: '#2F7A5C',
        },
        error: {
          DEFAULT: '#CD3636',
          light: '#F8D7DA',
          dark: '#912626',
        },
        warning: {
          DEFAULT: '#CD8A36',
          light: '#FFF3CD',
          dark: '#8A5A1F',
        },
      },

      fontFamily: {
        // Headings — Lato 400 · 700 · 900
        display: ['Lato', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // Body / UI — Nunito Sans 400 · 600 · 700
        sans: ['Nunito Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // Metrics, tickers, timestamps — JetBrains Mono 400 · 500
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
