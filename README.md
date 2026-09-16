# FX Replay — Growth Engineer Technical Challenge

> Production-minded marketing, acquisition, and experimentation experience centered around **"Try FX Replay Free"**, built with **Astro 5**, **React 19 Islands**, **TypeScript**, **Tailwind CSS**, and **Claude Code**.

---

## 📑 Challenge Deliverables Map

Every required deliverable from the technical challenge specification has been documented in depth:

1. **[Architecture Overview](docs/1-ARCHITECTURE.md):** Application structure, Astro vs. Webflow trade-offs, and production scaling roadmap.
2. **[Analytics & Measurement Plan](docs/2-ANALYTICS-PLAN.md):** Typed event taxonomy, conversion funnel targets, and reverse-proxy data accuracy.
3. **[A/B Experiment Proposal](docs/3-EXPERIMENT-PROPOSAL.md):** Prop Firm Challenge Headline experiment (Hypothesis, Control, Variant, Decision criteria).
4. **[AI-Native Workflow (Claude Code)](docs/4-AI-NATIVE-WORKFLOW.md):** `CLAUDE.md`, reusable skills, MCP architecture, and examples of human judgment over AI output.
5. **[Performance & Production Readiness](docs/5-PERFORMANCE-REVIEW.md):** Core Web Vitals audit (solving the 7.8s LCP / 3,770ms TBT), Technical SEO, and accessibility.

---

## ⚡ Quick Start (Local Setup)

The project requires **Node.js 18+** and uses an in-memory repository pre-seeded with trader data for zero-dependency local evaluation.

```bash
# 1. Clone repository
git clone https://github.com/asjohan/Fxreplay-technical-assessment.git
cd Fxreplay-technical-assessment

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Visit **`http://localhost:4321`** in your browser.

---

## 🔌 Users API Documentation

The project includes a fully integrated Users API supporting **Create**, **List**, and **Update** operations with strict Zod schema validation.

### 1. List Users (with Pagination)
```bash
curl -X GET "http://localhost:4321/api/users?limit=10&offset=0"
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "email": "alex.trader@example.com",
      "name": "Alex Morgan",
      "experienceLevel": "intermediate",
      "primaryMarket": "forex",
      "planTier": "free_trial",
      "createdAt": "2026-09-13T12:00:00.000Z"
    }
  ],
  "pagination": { "limit": 10, "offset": 0, "total": 2 }
}
```

### 2. Create User (Integrated into Signup Flow)
```bash
curl -X POST "http://localhost:4321/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jordan Bell",
    "email": "jordan@example.com",
    "experienceLevel": "advanced",
    "primaryMarket": "futures"
  }'
```

### 3. Update User
```bash
curl -X PUT "http://localhost:4321/api/users/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -H "Content-Type: application/json" \
  -d '{
    "planTier": "pro",
    "onboardingCompleted": true
  }'
```

---

## 🤖 AI-Native Development Assets

* **Project-Level Instructions:** [`CLAUDE.md`](CLAUDE.md) enforces architectural constraints, brand design tokens, and verification gates.
* **Reusable Claude Code Skill:** [`.claude/commands/cro-experiment.md`](.claude/commands/cro-experiment.md) automates the scaffolding and measurement of A/B test variants.

---

## 🚀 Deployment

The application is configured for 1-click deployment on **Vercel** (`@astrojs/vercel` adapter). The marketing landing page is statically prerendered at build time for sub-second global delivery, while the `/api/users` routes run on Vercel Serverless Functions.
