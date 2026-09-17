# FX Replay Frontend Build Specification & Master Copywriting Blueprint
**Target Audience:** Autonomous AI Agent (Claude Code / Opus 5) & Growth Engineering Team  
**Primary Goal:** Build an exact visual replica of `fxreplay.com` in Astro 5 SSR + React 19 Islands + Tailwind CSS, with zero layout shift (CLS = 0) dynamic experiment copy injection.

---

## 1. Quick Asset Directory & Brand Tokens

The AI agent must reference these assets and styles directly without searching or guessing:

### Asset Paths
* **Main Brand Logo:** `docs/FX_Replay_Brand_Kit/Brand Kit/logos/FXReplayLogo.svg`
* **White Isotype Mark:** `docs/FX_Replay_Brand_Kit/Brand Kit/logos/isotypeWhite.svg`
* **Black Isotype Mark:** `docs/FX_Replay_Brand_Kit/Brand Kit/logos/isotypeBlack.svg`
* *(Copy these SVGs to `public/logos/` if you stop hotlinking the Webflow CDN — see `IMAGE_ASSETS_CATALOG.md`.)*

### Design System & Color Tokens (Official FX Replay Brand Kit)

**Authoritative source:** `docs/FX_Replay_Brand_Kit/Brand Kit/brand-kit.html` (`PRIM` primitives + `SEM` semantic tokens).
**Implemented in:** `tailwind.config.mjs` — use the Tailwind token classes, never hard-code hex in components.

| Purpose | Semantic token -> primitive | Hex | Tailwind class |
|---|---|---|---|
| Page ground | `bg-primary` -> `dark-900` | `#030303` | `bg-surface` |
| Card surface | `bg-secondary` -> `dark-800` | `#0A0A0A` | `bg-surface-raised` |
| Inner / sub-surface | `bg-tertiary` -> `dark-700` | `#1A1A1A` | `bg-surface-inset` |
| Border | `border-primary` -> `dark-700` | `#1A1A1A` | `border-line` |
| Border (strong) | `border-secondary` -> `dark-600` | `#2A2A2A` | `border-line-strong` |
| Brand / CTA | `btn-bg-primary-active` -> `blue-600` | `#0260FD` | `bg-brand` |
| Brand hover | `btn-bg-primary-hover` -> `blue-800` | `#01307F` | `hover:bg-brand-hover` |
| Brand accent text | `btn-text-minimal-hover` -> `blue-500` | `#2C7BFD` | `text-brand-light` |
| Profit candles / positive P&L | `success` | `#53B483` | `bg-success` / `text-success` |
| Loss candles / negative P&L | `error` | `#CD3636` | `bg-error` / `text-error` |
| Text primary | `text-primary` -> `neutral-50` | `#F6F6F6` | `text-ink` |
| Text secondary | `text-secondary` -> `neutral-200` | `#D1D1D1` | `text-ink-muted` |
| Text disabled | `text-disabled` -> `neutral-400` | `#888888` | `text-ink-subtle` |

> **Note:** primary-button hover resolves **darker** (`blue-800 #01307F`), not lighter. `#2C7BFD`
> (`blue-500`) is a *text* accent (`btn-text-minimal-hover`), not a button fill.
> The kit's `tokens/tokens.css` and `source/` folders were absent from the delivered archive;
> the semantic layer is therefore reproduced in `tailwind.config.mjs`.

* **Typography:**
  * **Headings (`h1`, `h2`, `h3`):** `Lato`, sans-serif (Weights: 400, 700, 900) — `font-display`
  * **Body & UI:** `Nunito Sans`, sans-serif (Weights: 400, 600, 700) — `font-sans` (default)
  * **Tickers, Prices & Monospace:** `JetBrains Mono`, monospace (Weights: 400, 500) — `font-mono`

---

## 2. Component Architecture Tree

To maximize performance (99+ Lighthouse score), the landing page is split into **Static Astro Components (0 KB JS)** and a single **React Island**:

```
src/
├── components/
│   ├── LandingPage.astro       # Static: shared composition rendered by both `/` and `/freetrial`
│   ├── Navbar.astro            # Static: Logo, Nav Links, Sign In, Primary 'Get Started' CTA
│   ├── Hero.astro              # Static: Headline, Subtitle, CTA Button, Subtext (injects dynamic copy)
│   ├── ChartSimulator.tsx      # React Island (client:visible) — the ONLY island on the page
│   ├── FeatureTabs.astro       # Static: 4 Tabs (Journal, Prop Simulator, Mentor AI, Script), CSS-only switching
│   ├── KeyFeatures.astro       # Static: variant pillars + "Performance by time" CSS bar chart
│   ├── AssetCoverage.astro     # Static: Forex, Futures, Stocks, Crypto category filters & asset cards
│   ├── CommunityStories.astro  # Static: baseline traders (control) or ICP-personalized reviews
│   └── Footer.astro            # Static: Links, disclaimers, copyright
├── layouts/
│   └── Layout.astro            # Global shell, font preconnect/preload, SEO metadata
├── lib/
│   ├── copy-dictionary.ts      # The Master Copy Dictionary (Control, lp=1, lp=2, lp=3)
│   ├── analytics.ts            # Typed PostHog event dispatch wrapper
│   ├── schemas.ts              # Zod request/response contracts for /api/users
│   └── db.ts                   # User repository (Neon Postgres + in-memory fallback)
└── pages/
    ├── index.astro             # Root landing page — same experience as /freetrial
    ├── freetrial.astro         # Public Experiment Target: extracts ?lp=, injects copy, renders zero CLS
    ├── signup.astro            # Dedicated Signup Page: Form (Name, Email, Password, Goal), calls /api/users
    └── api/
        ├── users.ts            # GET list / POST create (Zod-validated)
        └── users/[id].ts       # PATCH update
```

> **Scope note:** `marketingengine.astro` (internal growth dashboard) is specified in
> `docs/GROWTH_MARKETING_ENGINE_PLAN.md` but is **not** part of the current build.

---

## 3. Section-by-Section Visual Breakdown (From Screenshots)

### Section 1: Top Navigation Bar (`Navbar.astro`)
* **Left:** `FXReplayLogo.svg` (height 28px)
* **Center Links:** `Features ∨`, `Resources ∨`, `FXR Battles`, `Pricing` (`text-ink-muted`, hover `text-ink`)
* **Right:**
  * Language Selector pill (`🇬🇧 EN`)
  * `Get Started` button: blue pill (`bg-brand hover:bg-brand-hover text-white px-5 py-2 rounded-full font-semibold text-sm transition-colors`) -> links to `/signup?lp=${lpParam}`.

---

### Section 2: Hero Section (`Hero.astro`)
* **Container:** Max-width 1000px, centered, padding `pt-24 pb-12 text-center`.
* **Eyebrow Tag:** Small pill badge above headline (`font-mono text-xs font-medium uppercase tracking-[0.2em] text-brand-light bg-brand/10 border border-brand/25 px-3 py-1 rounded-full`).
* **Headline:** `text-4xl md:text-6xl font-black leading-[1.15] text-ink mb-6` (Lato via `font-display`)
* **Subheadline:** `text-lg md:text-xl text-ink-muted max-w-2xl mx-auto mb-8 leading-relaxed`
* **Primary CTA:**
  * Blue pill button (`bg-brand hover:bg-brand-hover text-white px-8 py-3.5 rounded-full font-bold text-base shadow-lg shadow-brand/25 transition-colors`) -> links to `/signup?lp=${lpParam}`.
* **Subtext (Risk Reversal):** `text-sm text-ink-subtle mt-3`

---

### Section 3: Interactive TradingView Chart Simulator (`ChartSimulator.tsx`)
*Direct visual replica of Screenshot 2:*
* **Container:** Max-width 1100px, `rounded-2xl`, `border border-line`, `bg-surface`, `shadow-2xl`.
* **Top Replay Header Bar:** symbol + timeframe pill, live price with session badge.
* **Chart Surface:**
  * Rendered with `lightweight-charts` v4 (canvas-based).
  * Profit (`#53B483`) and loss (`#CD3636`) candlesticks on a `#1A1A1A` grid over `#030303`.
* **Floating Replay Control Widget (Center Overlay):**
  * Floating dark pill: `[Restart]` `[Play / Pause]` `[Step Forward]` `1m Step`.
* **Bottom Execution Bar:**
  * `BUY` button (`bg-success`), `SELL` button (`bg-error`), `Lots: 1.00`, `Account Balance: $50,000.00`.

---

### Section 4: Feature Tabs Section (`FeatureTabs.astro`)
*Direct visual replica of Screenshot 3:*
* **Tab Switcher (Dark Pill Bar):**
  * 4 Tabs: `FXR Journal` | `Prop firm simulator` | `Mentor AI` | `FXR Script`
  * Active state: `bg-surface-inset` with `text-ink`; inactive: `text-ink-muted`.
  * Switching is a pure CSS radio-input pattern — 0 KB of JavaScript.
* **Content Card:**
  * Left Side:
    * Headline: `text-3xl md:text-4xl font-black text-ink mb-4`
    * Subheadline: `text-ink-muted leading-relaxed mb-6`
    * CTA: variant `feature_tab.cta_text` (blue pill button)
  * Right Side:
    * Mockup preview image from `IMAGE_ASSETS_CATALOG.md` §3.

---

### Section 5: Key Features & Analytics Showcase (`KeyFeatures.astro`)
*Direct visual replica of Screenshot 4:*
* **Header:**
  * Title: **"Explore our key features"**
  * Subtitle: *"Maximize your trading potential with FX Replay."*
* **Left Feature Column:** the active variant's `pillars[]` from the copy dictionary; the second
  item is highlighted (`border-brand/40 bg-brand/10`).
* **Right Visual Card:**
  * Card header: "Performance by time" (Dropdown: "By hour")
  * Bar chart visualization: hourly bars (00, 01, 02... 08) with `bg-success` top sections and
    `bg-error` bottom sections. Pure CSS — no charting library.

---

### Section 6: Multi-Asset Coverage Grid (`AssetCoverage.astro`)
*Direct visual replica of Screenshot 5:*
* **Header:**
  * Title: **"Assets"**
  * Right button: `Explore more` (ghost rounded button)
* **Filter Pills:** `Forex` (active) | `Futures` | `Stocks` | `Crypto` | `Indexes` | `Other`
* **Grid:** 6 Asset Cards (3 columns x 2 rows)
  * Each card has:
    * Icon + Asset Symbol (e.g. `EURUSD`, `USDCHF`, `DXY`, `SPX500`, `NAS100`, `US30`)
    * Asset Tag (`Forex` / `Indexes`)
    * `Available brokers:` Badges (`OANDA`, `Dukascopy`, `Pepperstone`)
    * `Plan access:` `Beginner+`
    * `Timeframes:` `5s, 1m, 1h, 1D, +6`
    * `Initial date:` Historical date (e.g. `January 2, 2005`)

---

### Section 7: Community Stories (`CommunityStories.astro`)
* **Header:** "Stories from the community" / *"Real experiences from traders committed to earning their progress."*
* **Grid:** 3 review cards from the variant's `reviews[]`.
  * Control renders the baseline traders with their video thumbnails (`IMAGE_ASSETS_CATALOG.md` §4).
  * Segmented variants render ICP-personalized reviews with an initials avatar.

---

## 4. Copy Dictionary

The copy is **not** defined here. Two files own it, and they must stay in sync:

| Concern | Owner |
|---|---|
| Copy content + schema (canonical) | `docs/EXPERIMENT_VARIANTS_COPY.md` |
| Implementation | `src/lib/copy-dictionary.ts` |

`src/lib/copy-dictionary.ts` exports `COPY_DICTIONARY` keyed by `lp` param
(`control`, `1`, `2`, `3`) using the `ExperimentVariantCopy` interface defined in
`EXPERIMENT_VARIANTS_COPY.md` §4 — `variant_id`, `lp_param`, `eyebrow`, `hero`,
`feature_tab`, `pillars[]`, `reviews[]`, and the signup copy block.

Resolution happens server-side:

```ts
const lpSearchParam = Astro.url.searchParams.get('lp');
const copy = getCopyForVariant(lpSearchParam); // falls back to control
const lp = getLpParam(lpSearchParam);
```

Unknown or missing `lp` values resolve to `control`, so a malformed ad URL always
renders a valid baseline page.

---

## 5. Chart Simulator

Implemented at `src/components/ChartSimulator.tsx` — the only React island on the page
(`client:visible`), built on `lightweight-charts` v4.

- Candle data is a deterministic seeded random walk, so the demo renders identically on
  every load.
- Replay controls (play / pause / step / restart) progressively reveal candles, demonstrating
  the product's core mechanic rather than showing a static chart.
- Canvas colors live in a single `CHART_THEME` constant that mirrors the design tokens in
  `tailwind.config.mjs` (canvas painting cannot use Tailwind classes).
- First interaction fires one `backtest_preview_interacted` analytics event.
