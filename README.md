# FX Replay — Growth Engineer Technical Challenge

**Johan Daniel Álvarez** · Astro 5 · React 19 · Tailwind · TypeScript · Neon Postgres · PostHog · Vercel

### 🔗 Live: **[fxreplay-technical-assessment.vercel.app](https://fxreplay-technical-assessment.vercel.app/)**
### 📄 Full write-up: **[SUBMISSION.md](SUBMISSION.md)** — all six deliverables in one document.

---

## Links

| Route | What you'll see |
|---|---|
| [`/`](https://fxreplay-technical-assessment.vercel.app/) | Landing page, control copy |
| [`/freetrial?lp=1`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=1) | **ICP 1** — Prop Firm Challenge Hunter |
| [`/freetrial?lp=2`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=2) | **ICP 2** — 9-to-5 Weekend Warrior |
| [`/freetrial?lp=3`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=3) | **ICP 3** — TradingView Skeptic |
| [`/signup?lp=1`](https://fxreplay-technical-assessment.vercel.app/signup?lp=1) | Signup page (a real page, not a modal) |
| [`/marketingengine`](https://fxreplay-technical-assessment.vercel.app/marketingengine) | 🔐 Admin console |
| [`/api/users`](https://fxreplay-technical-assessment.vercel.app/api/users?limit=5) | Signups API |

**Admin login:** `admin` / `fxreplay`
Conversion overview, variant copy comparison, traffic allocation, signup attribution, and
the autonomous agent's decision log.

### Seeing a specific variant

Each `?lp=` bucket serves one of three competing headlines plus the control, assigned
server-side and sticky per visitor — so reloading keeps you in the same arm. To force one
for review, append `&variant=` with any arm of that experiment, keyed to
[`src/lib/copy-dictionary.ts`](src/lib/copy-dictionary.ts):

| | |
|---|---|
| ICP 1 | [`prop_fees`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=1&variant=prop_fees) · [`prop_rules`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=1&variant=prop_rules) · [`prop_funded`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=1&variant=prop_funded) |
| ICP 2 | [`weekend_year`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=2&variant=weekend_year) · [`weekend_reps`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=2&variant=weekend_reps) · [`weekend_career`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=2&variant=weekend_career) |
| ICP 3 | [`tv_bias`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=3&variant=tv_bias) · [`tv_precision`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=3&variant=tv_precision) · [`tv_journal`](https://fxreplay-technical-assessment.vercel.app/freetrial?lp=3&variant=tv_journal) |

Preview traffic is excluded from experiment results. Unknown `lp` values fall back to control.

---

## Run it locally

```bash
npm install
npm run dev
```

Serves `http://localhost:4321` with an in-memory database — nothing to set up. Add a
`DATABASE_URL` and run `npm run db:migrate` for real Postgres.

```bash
npm run db:status                  # what's in the database
npm run db:report                  # signups by experiment arm and channel
npm run eval-test -- --dry-run     # run the evaluation agent, change nothing
```

---

Long-form deliverables live in [`docs/`](docs/) — [architecture](docs/1-ARCHITECTURE.md),
[analytics](docs/2-ANALYTICS-PLAN.md), [experiment proposal](docs/3-EXPERIMENT-PROPOSAL.md),
[AI workflow](docs/4-AI-NATIVE-WORKFLOW.md), [performance](docs/5-PERFORMANCE-REVIEW.md).
