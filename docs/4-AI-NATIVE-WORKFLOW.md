# Deliverable 4: AI-Native Growth Engineering Workflow
**FX Replay Growth Engineering Technical Assessment**  
**Core Framework:** Claude Code (Agentic Architecture, Custom Skills & MCP Ecosystem)  
**Configuration Files Committed:** `CLAUDE.md`, `.claude/skills/growth-experiment-analyzer/SKILL.md`

---

## 1. Executive Philosophy: AI as an Operating System

At FX Replay, AI-native growth development is not about using an LLM for passive code autocomplete or casually asking questions. It is about designing an **autonomous, self-governing growth engineering system** that removes human latency across the entire experimentation lifecycle:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Qualitative ICP │ ───►  │ AI Experiment   │ ───►  │ Zero-CLS SSR    │ ───►  │ Autonomous Cron │
│ Research Pod    │       │ Copy Generation │       │ Astro Execution │       │ Decision Triage │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Research & Synthesis:** Agents digest messy community feedback (Reddit `r/Forex`, Trustpilot reviews, Discord channels) into structured psychological profiles.
2. **Experiment Permutation:** Agents generate localized copy payloads across the **4 Hero Variables** (Headline, Subhead, CTA, Hero Image) and match them with ultra-personalized client reviews.
3. **Deterministic Verification:** Mathematical statistical testing (Z-score, $p$-value, sample size gating) is strictly decoupled from LLM inference to guarantee 100% mathematical validity.
4. **Autonomous Triage:** The system auto-promotes winners, auto-kills bleeding variants, and alerts humans only when real edge cases require human judgment.

---

## 2. Project-Level Instructions (`CLAUDE.md`)

The root `CLAUDE.md` acts as the **permanent memory bank** for any AI agent working within the repository. It enforces architectural constraints, token-saving rules, and design tokens:

### Key Constraints Codified in `CLAUDE.md`:
* **Zero Guessing Policy:** The AI is strictly directed to read existing specifications in `docs/` (`FRONTEND_BUILD_SPEC.md`, `DATABASE_SCHEMA.md`, `EXPERIMENT_VARIANTS_COPY.md`) rather than spending tokens brainstorming or hallucinating layouts.
* **Zero-JS Default:** Marketing content, feature cards, and asset lists must compile to static `.astro` components (0 KB client JavaScript), preserving sub-second LCP.
* **Islands Architecture Discipline:** React is isolated to a single interactive surface: `<ChartSimulator client:visible />` using `lightweight-charts`. Signup is a dedicated page rather than a modal island.
* **Zero Layout Shift (CLS = 0.00):** URL variables (`?lp=1`) must be extracted server-side in frontmatter (`Astro.url.searchParams`) to pre-render the exact copy before HTML delivery.

---

## 3. The Specialized Multi-Agent Growth Pod

Rather than relying on a single monolithic prompt, we structure four autonomous agents with explicit boundaries:

```
                          ┌────────────────────────────────────────────────────────┐
                          │                Orchestrator Agent                      │
                          └───────────────────────────┬────────────────────────────┘
                                                      │
         ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
         │                                            │                                            │
         ▼                                            ▼                                            ▼
┌──────────────────┐                         ┌──────────────────┐                         ┌──────────────────┐
│  Research Agent  │                         │ Copy Agent       │                         │ Analytics Agent  │
├──────────────────┤                         ├──────────────────┤                         ├──────────────────┤
│ • Scans user     │                         │ • Ingests ICP    │                         │ • Audits event   │
│   feedback       │                         │   profiles       │                           taxonomy         │
│ • Maps pain      │                         │ • Generates 4    │                         │ • Verifies DB    │
│   points to ICPs │                         │   hero variables │                         │   reconciliation │
└──────────────────┘                         └──────────────────┘                         └──────────────────┘
```

| Agent Role | Scope of Authority | Input Data | Concrete Output |
| :--- | :--- | :--- | :--- |
| **1. Qualitative Research Agent** | Synthesizes trader sentiment, competitor complaints (TradingView replay bugs), and prop challenge failures. | Trustpilot reviews, Reddit threads, Webflow copy | Structured entries in `docs/ICP_PROFILES.md` |
| **2. Experiment & Copy Agent** | Generates high-converting messaging variations across the 4 Hero Variables and pairs them with authentic testimonials. | Target ICP + baseline copy | Verified `copy_payload` JSON ready for Neon DB seeding |
| **3. Analytics & QA Agent** | Audits PostHog event payloads, verifies reverse proxy configuration, and ensures data fidelity. | API contracts, event logs | Telemetry integrity reports in `docs/2-ANALYTICS-PLAN.md` |
| **4. Autonomous Evaluation Agent** | Runs headless cron evaluations, calculates Z-scores, and triages experiments (Auto-Promote, Auto-Kill, Human Review). | PostHog API, Neon DB | Webhook alerts, DB status updates |

---

## 4. Reusable Skill: `growth-experiment-analyzer`

We have implemented and committed a reusable Claude Code skill located at:
📁 **`.claude/skills/growth-experiment-analyzer/SKILL.md`**

### What the Skill Does:
When invoked via `/evaluate-experiment` or by the background cron, the skill:
1. Ingests raw impression and conversion counts for Control and Treatment arms.
2. Computes the **Two-Tailed Z-Test** and validates whether the sample size meets the MDE threshold ($n \ge 1,240$).
3. Returns a structured JSON evaluation and human-readable decision recommendation:
   - `STATUS: WINNER_SHIP_NOW` ($p < 0.05$, Lift $\ge +15\%$)
   - `STATUS: CIRCUIT_BREAKER_KILL` (Lift $\le -20\%$, $n \ge 500$)
   - `STATUS: UNDERPOWERED_CONTINUE` (Insufficient sample size)

---

## 5. Model Context Protocol (MCP) Integration Strategy

The challenge allows documenting the production MCP architecture where a full local setup would add unnecessary review friction:

```
┌─────────────────────────────────────────────────────────────┐
│                 AUTONOMOUS BACKGROUND CRON                  │
│               (Headless Node.js on Vercel)                  │
├─────────────────────────────────────────────────────────────┤
│ • Connects directly via PostHog REST API + Neon DB Client   │
│ • Runs scheduled evaluations 2x daily                       │
│ • Executes automated Kill / Promote logic                   │
│ • ZERO dependency on desktop software or open laptops       │
└─────────────────────────────────────────────────────────────┘

                              VS.

┌─────────────────────────────────────────────────────────────┐
│                 DESKTOP MCP FOR CLAUDE CODE                 │
│              (Growth Engineer's Workstation)                │
├─────────────────────────────────────────────────────────────┤
│ • Used for AD-HOC EXPLORATION & CREATIVE IDEATION           │
│ • Interactive queries: "Claude, inspect why mobile dropped  │
│   yesterday and generate 3 new headline variations"         │
│ • Resolving Human-in-the-Loop inconclusive experiments      │
│ • Bridges engineering diagnostics with copy generation      │
└─────────────────────────────────────────────────────────────┘
```

### Production MCP Connections:
1. **PostHog MCP (`@posthog/mcp`):**
   - *Why:* Enables the growth engineer to ask Claude in natural language: *"Query the conversion funnel for experiment `exp_q3_hero` broken down by browser"* without leaving the IDE.
2. **Neon PostgreSQL MCP (`@modelcontextprotocol/server-postgres`):**
   - *Why:* Gives agents secure, read-only introspection into active `experiments`, `experiment_variants`, and `session_metrics` tables.
3. **Sentry Error Tracking MCP (`@sentry/mcp`):**
   - *Why:* Acts as an automated safety monitor during variant rollout. If a new variant triggers JavaScript exceptions, the agent catches it immediately.

---

## 6. Engineering Judgment & AI Leverage

In growth engineering, knowing **what NOT to delegate to AI** is just as critical as leveraging it.

### What We Intentionally Did Ourselves (Human Judgment):
1. **The Strategic ICP Loss-Aversion Thesis:**
   - *Human Insight:* Recognizing that retail prop traders are losing $300–$500 per challenge attempt, and that loss aversion is a 3x stronger conversion motivator than generic "trading practice." Standard LLM prompts default to generic cliches like *"Become a master trader."*
2. **The Single-Template CRO Rule:**
   - *Human Decision:* Strictly locking the page layout, navigation, and modal structure across all variants. An unconstrained AI would have generated 4 completely different page designs, ruining the scientific validity of the test.
3. **Server-Side Pre-Rendering for Zero CLS:**
   - *Human Architecture:* Mandating that variant copy must be injected on the Vercel server via `searchParams` rather than client-side `useEffect`, ensuring Core Web Vitals (CLS = 0) and ad quality scores are protected.

### What We Delegated to AI (High-Leverage Execution):
1. **Rapid Permutation of Copy Decks:** Expanding the core loss-aversion angle into complete, multi-component copy matrices (Eyebrow, Headline, Subhead, CTA, Feature Pills, and Testimonials).
2. **Schema & SQL Generation:** Writing the PostgreSQL DDL migrations, TypeScript interfaces, and Zod validation contracts in [DATABASE_SCHEMA.md](file:///C:/Users/JohanDanielA/Documents/GitHub/Fxreplay-technical-assessment/docs/DATABASE_SCHEMA.md).
3. **Statistical Code Generation:** Implementing the exact mathematical formulas for two-tailed Z-tests and MDE sample size thresholds.

### Examples of AI Output We Corrected or Rejected:
* ❌ **Rejected:** Overly aggressive "prop firm guaranteed pass" copy generated during initial ideation. Prop firms ban guaranteed claims, and retail traders perceive them as scam indicators. We corrected the tone to focus on **risk management, statistical edge, and stress-testing drawdown rules**.
* ❌ **Rejected:** Client-side A/B redirection (`window.location.replace('/freetrial-variant-1')`). This damages SEO crawl budgets and causes layout flicker. We replaced it with single-template server-rendered query parameter injection (`/freetrial?lp=1`).
* ❌ **Corrected:** Premature stopping logic. The AI initially suggested concluding tests after 100 conversions. We corrected the engine to enforce a minimum sample size ($n \ge 1,240$ per variant) and a 7-day runtime to eliminate weekend/weekday bias.
