# CLAUDE.md — Project Memory & Agent Constraints for FX Replay Growth

## Project Overview
This repository contains the high-performance growth & marketing experience for FX Replay ("Try FX Replay Free"), built with **Astro 5 (SSR mode with static prerendering)**, **React 19 Islands**, **TypeScript**, and **Tailwind CSS**.

## Architectural Principles
1. **Zero-JS Default:** Marketing content, copy, and SEO sections must be pure Astro components (`.astro`) with zero client-side JavaScript to maintain sub-second LCP and 98+ Lighthouse scores.
2. **Islands for Interactivity:** Use React (`.tsx`) exclusively for interactive surfaces (e.g., `<SignupModal client:load />`, `<BacktestPreview client:idle />`).
3. **Type-Safe API Contracts:** All API endpoints (`/api/users`) must validate request payloads using Zod schemas (`src/lib/schemas.ts`) before processing.
4. **Explicit Analytics Instrumentation:** Every user conversion interaction must dispatch a typed event via `analytics.track()` in `src/lib/analytics.ts`. Never rely on unvalidated autocapture.

## Design System & Tokens
- **Backgrounds:** `#080A0F` (Base dark), `#0F131C` (Card surface), `#1E2638` (Borders).
- **Accents:** `#2563EB` (FX Replay Brand Blue), `#00D26A` (Profit green/success), `#F93958` (Loss red/error).
- **Typography:** Inter (Headings & Body), JetBrains Mono (Financial metrics & timestamps).

## Common Development Commands
- `npm run dev`: Start local development server on `http://localhost:4321`.
- `npm run build`: Compile static pages and Vercel serverless functions into `dist/`.
- `npm run preview`: Preview production build locally.

## Claude Code Agent Workflow Constraints
- When creating or modifying A/B experiment components, never remove baseline conversion event triggers.
- Always run `npm run build` after editing TypeScript or Astro files to ensure type compliance before committing.
- Commit messages must follow conventional commits: `feat:`, `fix:`, `perf:`, `docs:`, or `cro:`.
