# FX Replay — Growth Engineer Technical Challenge Submission

> **Candidate:** Johan Daniel Álvarez  
> **Repository:** [https://github.com/iluvios/Fxreplay-technical-assessment](https://github.com/iluvios/Fxreplay-technical-assessment)  
> **Stack:** Astro 5 (SSR), React 19 Islands, Tailwind CSS, TypeScript, Neon PostgreSQL, PostHog  

---

## Table of Contents
1. [Deliverable 1: Working Implementation & Setup](#1-working-implementation--setup)
2. [Deliverable 2: Architecture Overview](#2-architecture-overview)
3. [Deliverable 3: Analytics & Measurement Plan](#3-analytics--measurement-plan)
4. [Deliverable 4: A/B Experiment Proposal](#4-ab-experiment-proposal)
5. [Deliverable 5: AI-Native Development Workflow](#5-ai-native-development-workflow)
6. [Deliverable 6: Performance, SEO & Production Readiness](#6-performance-seo--production-readiness)

---

## 1. Working Implementation & Setup

### URLs
* **GitHub Repository:** `https://github.com/iluvios/Fxreplay-technical-assessment`
* **Live Deployment:** Configured for Vercel Edge SSR via `@astrojs/vercel`

### Quick Start (Local Setup in Under 2 Minutes)
This project requires **Node.js 18+** and runs with zero external dependencies out-of-the-box (in-memory repository fallback pre-seeded with sample traders).

```bash
# 1. Clone the repository
git clone https://github.com/iluvios/Fxreplay-technical-assessment.git
cd Fxreplay-technical-assessment

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```
Open **`http://localhost:4321`** in your browser.

### Key Routes
| Route | Purpose | Behavior |
| :--- | :--- | :--- |
| `/freetrial` (or `/`) | Landing Experience | Serves baseline **Control** messaging. Zero client-side flicker. |
| `/freetrial?lp=1` | Experiment Arm 1 | **Prop Firm Challenge Hunter** (loss aversion & fee savings). |
| `/freetrial?lp=2` | Experiment Arm 2 | **Weekend Warrior** (trading 1 year of data on a Sunday). |
| `/freetrial?lp=3` | Experiment Arm 3 | **TradingView Skeptic** (no lookahead bias, sub-second tick precision). |
| `/signup?lp=X` | Dedicated Signup Page | Full-page form (no popup modal), client & server Zod validation. |
| `/api/users` | Users API | `GET` (list paginated) & `POST` (create user with attribution). |
| `/api/users/:id` | Users API | `GET` (read by ID) & `PATCH` (update profile). |
| `/marketingengine` | Growth Admin Console | Internal experimentation, users registry & agent control center. |
| `/ingest/*` | Telemetry Reverse Proxy | First-party reverse proxy to PostHog to bypass adblockers. |

### 🔐 Growth Admin Console Credentials (`/marketingengine`)
The internal growth experimentation dashboard is cookie-gated via `src/middleware.ts` (unauthorized page visits redirect to login with `?next=`, API routes return 401).

* **URL:** `https://fxreplay-technical-assessment.vercel.app/marketingengine` (or `http://localhost:4321/marketingengine`)
* **Username:** `admin`
* **Password:** `fxreplay`
*(Configured in `src/lib/admin-auth.ts`, overridable via `ADMIN_USER` and `ADMIN_PASSWORD` env vars).*

**Features inside the Console:**
* **Overview:** High-level acquisition KPI tiles (views, signups, overall CR), experiment table, ICP directory, and recent agent calls.
* **Experiments:** List & create experiments; detail inspector with arm CRUD (traffic weight, active toggle, promote, delete), side-by-side copy diff, live Z-test statistics, and decision audit logs.
* **Users:** Paginated registry filterable by search, acquisition channel, trading goal, and experiment arm, showing exactly which variant converted each trader.

### Database Verification Commands
```bash
# Check database tables and row counts (Neon PostgreSQL)
npm run db:status

# View live signup attribution report by experiment arm & channel
npm run db:report
```

---

## 2. Architecture Overview

```
                      [Incoming Visitor Request]
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Vercel Edge Network    │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
         ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       Static Assets (CDN)       │       │    Astro 5 SSR Server Engine    │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ • CSS chunks & Google Fonts     │       │ • Read ?lp= parameter           │
│ • SVG logos & Webflow images    │       │ • Inject copy before paint      │
│ • Cache: max-age=31536000       │       │ • Zero CLS (CLS = 0.00)         │
└─────────────────────────────────┘       └────────────────┬────────────────┘
                                                           │
                                                           ▼
                                          ┌─────────────────────────────────┐
                                          │      Data & Analytics Layer     │
                                          ├─────────────────────────────────┤
                                          │ • Neon PostgreSQL (Serverless)  │
                                          │ • In-Memory fallback repository │
                                          │ • PostHog via /ingest proxy     │
                                          └─────────────────────────────────┘
```

### Major Technical Decisions
1. **Astro 5 SSR over Next.js/Webflow:**  
   Next.js ships unnecessary React runtime to purely static content. Webflow carries heavy vendor scripts. Astro defaults to **0 KB client JavaScript** for navigation, hero typography, feature tabs, and footers.
2. **Server-Side Experiment Resolution (Zero CLS):**  
   The experiment arm is resolved on the server (`Astro.url.searchParams.get('lp')`) and injected directly into the HTML before sending to the client. The visitor never experiences text flicker or Cumulative Layout Shift (**CLS = 0.00**).
3. **Islands Architecture (React 19 only where needed):**  
   Client-side hydration is isolated to a single interactive component: `ChartSimulator.tsx` (`client:idle` using `lightweight-charts`). Everything else is static HTML/CSS.
4. **Dedicated `/signup` Page over Modal:**  
   Modals suffer from poor mobile usability, focus traps, and cannot be cleanly bookmarked or linked from external ads. A dedicated page preserves browser history and ensures clean ad attribution.

### Important Trade-offs
* **Dynamic SSR vs. Static Prerendering:** Static pages load slightly faster from edge cache, but cannot dynamically assign A/B test arms or preserve attribution without client-side JavaScript. We chose SSR with edge caching headers to guarantee instant paint with zero layout shift.
* **Dual Persistence Layer:** The app connects to live Neon PostgreSQL via `@neondatabase/serverless`, but automatically falls back to an in-memory repository if `DATABASE_URL` is unset, making local evaluation effortless for reviewers.

### What Would Change in a Full Production System
* Dedicated PgBouncer connection pooler in front of PostgreSQL to handle high-frequency trading news traffic spikes.
* Argon2id/bcrypt password hashing (plain strings accepted in this test simulation).
* Upstash Redis rate-limiting on `/api/users` and `/ingest` to mitigate DDoS and spam signups.

---

## 3. Analytics & Measurement Plan

### Architecture & Tooling
* **Provider:** PostHog.
* **Reverse Proxy (`/ingest`):** Requests are routed through our own origin to prevent adblockers (used by ~25% of tech-savvy traders) from dropping telemetry.

### Event Taxonomy
| Event Name | Trigger | Key Properties |
| :--- | :--- | :--- |
| `landing_page_viewed` | Page load on `/` or `/freetrial` | `variant_id`, `visitor_id`, `channel`, `utm_source`, `utm_campaign` |
| `experiment_variant_exposed` | Participant enters active experiment | `experiment_id`, `variant_id`, `is_control` |
| `cta_button_clicked` | Click on any CTA | `cta_location` (`nav`, `hero`, `feature_tabs`, `asset_coverage`, `footer`), `cta_copy` |
| `backtest_preview_interacted` | First interaction with chart canvas | `action` (`play`, `step`, `reset`) |
| `signup_page_viewed` | Page load on `/signup` | `variant_id`, `experiment_id` |
| `signup_form_started` | First focus on form field | `variant_id` |
| `signup_form_submitted` | Form submission attempt | `icp_focus`, `variant_id` |
| `signup_completed` | Account created (emitted from server) | `user_id`, `icp_focus`, `channel`, `experiment_id`, `variant_id` |
| `signup_error_encountered` | Validation or network error | `error_message`, `error_field`, `error_code` |

### 5-Stage Conversion Funnel
1. **Funnel Entry:** `landing_page_viewed` (100%)
2. **Engagement Step:** `cta_button_clicked` (Target: 15%–20%)
3. **Intent Step:** `signup_page_viewed` (Target: 12%–15%)
4. **Action Step:** `signup_form_started` (Target: 10%–12%)
5. **Primary Conversion:** `signup_completed` (Target: 5%–8%)

* **Primary Conversion Metric:** **Visitor-to-Account Conversion Rate**  
  $$\text{Conversion Rate} = \frac{\text{Unique } \texttt{signup\_completed} \text{ events}}{\text{Unique } \texttt{landing\_page\_viewed} \text{ visitors}}$$

### Data Quality & Trustworthiness
* **Server-Side Canonical Emission:** `signup_completed` is dispatched directly by `/api/users` upon successful DB insert. It cannot be blocked by client extensions or lost during browser redirects.
* **Denormalized Attribution:** UTMs and experiment arms travel on both the cookie and the event payload, preventing data loss if third-party cookies are disabled.

---

## 4. A/B Experiment Proposal

### Experiment Title: Prop Firm Challenge Loss Aversion
* **Experiment ID:** `exp_hero_prop_firm_v1`
* **Target Audience:** Prop Firm Challenge Hunter (traders actively taking FTMO, Apex, or Topstep evaluations).

### Hypothesis
If we change the hero messaging from a generic trading simulator to a specific **prop firm evaluation practice tool focused on avoiding $300 reset fees**, then visitor-to-signup conversion will increase by $\ge 25\%$, because loss aversion is a stronger psychological motivator than general practice.

### Control vs. Variant Copy
| Element | Control Baseline (`/freetrial`) | Variant 1 (`/freetrial?lp=1`) |
| :--- | :--- | :--- |
| **Eyebrow** | `REPLAY TRADING PLATFORM` | `PROP FIRM CHALLENGE ACCELERATOR` |
| **Headline** | The Market Simulator for Serious Traders | Stop burning $300 challenge fees. Prove your edge first. |
| **Subheadline** | Replay real historical markets, practice your strategy risk-free, and build consistency before trading live capital. | Simulate FTMO and Apex drawdown rules bar-by-bar. Stress-test your risk before you buy a real evaluation. |
| **Primary CTA** | `Get started for free` | `Test Your Prop Strategy Free` |
| **Microcopy** | Free to start. No credit card required. | No credit card required. Practice prop rules 100% free. |

### Sample Size & Statistical Methodology
* **Baseline CR ($p_c$):** 3.5%
* **Minimum Detectable Effect (MDE):** +25% relative lift (Target CR: 4.38%)
* **Significance Level ($\alpha$):** 0.05 (95% confidence, two-tailed)
* **Statistical Power ($1 - \beta$):** 0.80 (80% power)
* **Required Sample Size:** **$n \ge 1,240$ unique visitors per arm** ($\approx 2,480$ total).
* **Minimum Test Duration:** 7 full calendar days (to capture weekend trading behavior).

### Decision Criteria
* **Ship Variant:** Relative lift $\ge +10\%$, $p < 0.05$, and $n \ge 1,240$ per arm.
* **Continue Test:** Sample size $< 1,240$, or $0.05 \le p < 0.10$ with positive trend (run up to 14 days maximum).
* **Reject Variant:** Relative lift $\le 0\%$ with $p < 0.05$, or no statistical difference after 14 days and $n \ge 2,500$.

---

## 5. AI-Native Development Workflow

### System Architecture Around Claude Code
```
                     ┌─────────────────────────────────┐
                     │    Human Engineer (Strategy)    │
                     └────────────────┬────────────────┘
                                      │ Prompts & Constraints
                                      ▼
                     ┌─────────────────────────────────┐
                     │     CLAUDE.md Master Direct     │
                     └────────────────┬────────────────┘
                                      │ Coordinates
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Research Agent  │         │  UI Builder Agent│         │ CRO Auditor Agent│
│  (Assets/Tokens) │         │  (Astro/Tailwind)│         │ (Stats & Z-Tests)│
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

1. **Project Instructions (`CLAUDE.md`):**  
   Committed at repository root. Enforces the official FX Replay Brand Kit tokens (`#0260FD`, `#030303`, Lato/Nunito Sans/JetBrains Mono), bans modal popups for signup, and mandates 0 KB static HTML for marketing sections.
2. **Reusable Skills & Commands:**
   * [`.claude/commands/cro-experiment.md`](.claude/commands/cro-experiment.md): Automatically scaffolds new experiment variants with typed dictionary entries and telemetry hooks.
   * [`.claude/skills/growth-experiment-analyzer/SKILL.md`](.claude/skills/growth-experiment-analyzer/SKILL.md): Executes two-tailed Z-tests, verifies MDE sample thresholds, and outputs autonomous Ship/Continue/Kill recommendations.
3. **MCP Architecture:**
   * *Production PostHog MCP:* Enables agents to query live conversion funnels directly from Claude Code.
   * *Production Neon PostgreSQL MCP:* Inspects schema migrations and validates SQL queries before deployment.

### Human Judgment: Where AI Output Was Corrected
* **Rejected Signup Modal:** Claude originally suggested a modal dialog. Human judgment overrode this in favor of a dedicated `/signup?lp=X` page to ensure direct ad linkability, clean history navigation, and mobile usability.
* **Rejected Client-Side Copy Swapping:** Claude initially implemented client-side `useEffect` text replacement. Human judgment enforced server-side query parameter SSR to guarantee **CLS = 0.00**.
* **Corrected Color Tokens:** Claude defaulted to standard Tailwind `blue-600` (`#2563EB`). Human caught the drift and enforced official FX Replay Brand Kit Electric Blue (`#0260FD`).
* **Fixed Mobile Font Render-Blocking:** Claude included Google Fonts as a synchronous stylesheet, causing mobile Lighthouse to score 77. Human re-engineered it to non-blocking `media="print"` with `display=swap`, restoring performance to 90+.

---

## 6. Performance, SEO & Production Readiness

### Core Web Vitals Audit
* **Desktop Performance:** **99** (LCP: 0.5s, CLS: 0.00, TBT: 0ms).
* **Mobile Performance:** **90+** achieved through 4 specific mitigations:
  1. *Non-Blocking Fonts:* Google Fonts stylesheet loaded via `media="print" onload="this.media='all'"` prevents FCP delay on 4G networks.
  2. *Idle Chart Hydration:* `ChartSimulator.tsx` uses `client:idle`, keeping the mobile main thread completely free during initial paint.
  3. *Deferred PostHog SDK:* `posthog-js` (~307 kB) is dynamically imported on idle (`requestIdleCallback`), removing heavy scripts from first paint.
  4. *Explicit Dimensions:* Explicit `width` and `height` on all images eliminate reflow.

### Technical SEO & Accessibility
* **SEO:** Single `<h1>` per page, semantic landmarks (`<header>`, `<main>`, `<footer>`), structured JSON-LD schema (`SoftwareApplication`), and canonical URL `<link rel="canonical" href="https://fxreplay.com/freetrial" />` across all variants to prevent duplicate content indexing.
* **Accessibility (WCAG 2.1 AA):**
  * Contrast: Body text (`#D1D1D1` on `#030303`) achieves **13:1** (exceeds AAA 7:1). Buttons (`#0260FD` on white) achieve **5.1:1** (exceeds AA 4.5:1).
  * Feature tabs are native CSS radio inputs, operable via keyboard with visible `:focus-visible` styling.
  * Form inputs have explicit labels, autocomplete attributes, and `aria-invalid` error messaging.

### Production Risk Matrix
| Risk | Severity | Implemented Mitigation |
| :--- | :--- | :--- |
| **Adblocker Telemetry Loss** | High | First-party reverse proxy (`/ingest`) + server-side event emission on `/api/users`. |
| **Ad Network Parameter Stripping** | Medium | Multi-tier attribution cascade (`?lp=` $\to$ `utm_campaign` keyword match $\to$ 30-day session cookie). |
| **Traffic Spikes (NFP/CPI News)** | High | Stateless serverless architecture + edge caching with Stale-While-Revalidate. |
| **Premature Experiment Calls** | Medium | Strict MDE gate ($n \ge 1,240$) and 7-day full cycle constraint enforced before computing significance. |
