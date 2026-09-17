# CLAUDE.md — Master Directive for Claude Code (Opus 5)

## 1. Primary Mandate (Token-Saving Rule)
**YOUR SOLE ROLE IS TO IMPLEMENT THE UI/UX DESIGN AND PAGE STRUCTURE.**  
Do not invent copy, do not design new layouts, do not write documentation, and do not over-engineer analytics. All specifications, image URLs, and copy dictionaries are already finalized in `docs/`:

* **Visual Design Blueprint:** Read `docs/FRONTEND_BUILD_SPEC.md` (Matches `fxreplay.com` 1:1).
* **Live Image & Logo CDN URLs:** Read `docs/IMAGE_ASSETS_CATALOG.md` (Direct Webflow CDN links for all logos, mockups, and broker badges).
* **Copy Dictionaries:** Read `docs/EXPERIMENT_VARIANTS_COPY.md` (Use the exact pre-written copy variables; do NOT brainstorm new copy).
* **Database Schema:** Read `docs/DATABASE_SCHEMA.md` (5 PostgreSQL tables for Neon).

---

## 2. Core Architectural & Flow Constraints
1. **NO POPUP MODAL FOR SIGNUP:**
   - All CTA buttons (`Get started for free`, `Test Your Prop Strategy Free`, etc.) must link directly to the **dedicated signup page: `/signup?lp=X`**.
   - Create `src/pages/signup.astro` containing the registration form (`name`, `email`, `password`, `icp_focus`) posting to `/api/users`.
2. **Framework & Islands Discipline (Astro 5 + Tailwind + React):**
   - Marketing content, navigation, feature tabs, and asset tables must be **100% static `.astro` components (0 KB client JavaScript)** to preserve sub-second LCP.
   - The only React island is `src/components/ChartSimulator.tsx` (`client:idle` using `lightweight-charts`).
3. **Zero Cumulative Layout Shift (CLS = 0.00):**
   - On `src/pages/freetrial.astro` (and `index.astro`), read `Astro.url.searchParams.get('lp')` on the server to inject the pre-written copy before HTML delivery. Never swap text client-side.
4. **Lean Analytics:**
   - Do not spend tokens setting up complex PostHog trackers. Use a simple clean helper in `src/lib/analytics.ts` that dispatches typed events.

---

## 3. Official FX Replay Brand Kit Tokens
**Source of truth:** `docs/FX_Replay_Brand_Kit/Brand Kit/brand-kit.html` (44 primitives + 60 semantic tokens).
**Implemented in:** `tailwind.config.mjs` — the single source of truth for the UI palette.
Use the Tailwind token classes below; **never hard-code hex in components.**

> Note: the kit's `tokens/tokens.css` and `source/` folders were missing from the delivered
> archive, so the semantic layer is reproduced in `tailwind.config.mjs`.

| Purpose | Semantic token | Primitive | Hex | Tailwind class |
|---|---|---|---|---|
| Brand / CTA | `btn-bg-primary-active` | `blue-600` | `#0260FD` | `bg-brand` |
| Brand hover | `btn-bg-primary-hover` | `blue-800` | `#01307F` | `hover:bg-brand-hover` |
| Brand pressed | `btn-bg-primary-pressed` | `blue-900` | `#012054` | `bg-brand-pressed` |
| Brand accent (text) | `btn-text-minimal-hover` | `blue-500` | `#2C7BFD` | `text-brand-light` |
| Page ground | `bg-primary` | `dark-900` | `#030303` | `bg-surface` |
| Card surface | `bg-secondary` | `dark-800` | `#0A0A0A` | `bg-surface-raised` |
| Inner surface | `bg-tertiary` | `dark-700` | `#1A1A1A` | `bg-surface-inset` |
| Border | `border-primary` | `dark-700` | `#1A1A1A` | `border-line` |
| Border (strong) | `border-secondary` | `dark-600` | `#2A2A2A` | `border-line-strong` |
| Text primary | `text-primary` | `neutral-50` | `#F6F6F6` | `text-ink` |
| Text secondary | `text-secondary` | `neutral-200` | `#D1D1D1` | `text-ink-muted` |
| Text disabled | `text-disabled` | `neutral-400` | `#888888` | `text-ink-subtle` |
| Profit / success | `success` | — | `#53B483` | `text-success` / `bg-success` |
| Loss / error | `error` | — | `#CD3636` | `text-error` / `bg-error` |
| Warning | `warning` | — | `#CD8A36` | `text-warning` / `bg-warning` |

- **Typography:**
  - **Headings (`h1`, `h2`, `h3`):** `Lato` (400, 700, 900) — `font-display`
  - **Body / UI Text:** `Nunito Sans` (400, 600, 700) — `font-sans` (default)
  - **Metrics & Tickers:** `JetBrains Mono` (400, 500) — `font-mono`

---

## 4. Key Development Commands
- `npm run dev`: Start local development server (`http://localhost:4321`)
- `npm run build`: Verify TypeScript compliance and build output
- `npm run db:migrate`: Apply `scripts/schema.sql` + `scripts/seed.sql` (idempotent)
- `npm run eval-test -- --dry-run`: Run the evaluation agent without writing or changing traffic

---

## 5. Agent Surfaces (see `docs/4-AI-NATIVE-WORKFLOW.md`)
Two distinct things are called "agent" in this repo — do not conflate them:
- **`src/lib/agent/`** is *application code*: a headless cron job on Vercel. No Claude Code, no MCP.
- **`.claude/agents/`** are *development subagents*: `experiment-copywriter` (writes one
  `COPY_DICTIONARY` entry under the prohibited-claims list) and `analytics-auditor` (read-only
  check that exposures and conversions still join).

**Never compute experiment statistics by hand.** `src/lib/stats.ts` is deterministic and gates
an automated kill switch; route every numeric question through `npm run eval-test -- --dry-run`.

**Variant assignment is server-side** via `resolveLiveExperience()` in `src/lib/experiment-repo.ts`.
Do not select copy with `analytics.getVariant()` — that is a client-side flag read and would
reintroduce the layout shift §2.3 forbids.

One decision vocabulary everywhere: `PROMOTE` · `KILL` · `HUMAN_REVIEW` · `CONTINUE`.
