# Deliverable 4: AI-Native Growth Engineering Workflow

**FX Replay Growth Engineering Technical Assessment**

Everything described here is committed and runnable. File paths are links to real files;
commands are commands that work. Where something is a proposal rather than an
implementation, it says so explicitly.

| Surface | Path |
| :--- | :--- |
| Project instructions | `CLAUDE.md` |
| Development subagents | `.claude/agents/experiment-copywriter.md`, `.claude/agents/analytics-auditor.md` |
| Skill | `.claude/skills/growth-experiment-analyzer/SKILL.md` |
| Command | `.claude/commands/cro-experiment.md` |
| MCP servers | `.mcp.json` |
| Runtime agent (application code) | `src/lib/agent/` |

---

## 1. Two different things are called "agent" here

This distinction matters and is easy to blur:

**Development-time subagents** (`.claude/agents/`) run inside Claude Code on an
engineer's machine. They help *build* the product. They are markdown files.

**The evaluation agent** (`src/lib/agent/`) is application code that runs headless on
Vercel Cron in production. It uses no Claude Code, no MCP, and no desktop session. It
calls an LLM over plain HTTPS for one narrow task and would keep working if every
developer's laptop were closed.

Conflating them produces architecture diagrams that cannot be deployed. The rest of this
document keeps them separate.

---

## 2. Project-level instructions (`CLAUDE.md`)

`CLAUDE.md` is the constraint file every agent in the repo inherits. Its job is to stop
the failure modes that are specific to letting a model write growth code:

- **Zero guessing.** Specs, image URLs and copy dictionaries already exist in `docs/`.
  The model is directed to read them rather than invent copy — the most expensive thing
  an LLM does on a marketing codebase is confidently produce plausible new messaging that
  nobody approved.
- **Zero-JS default.** Marketing content compiles to static `.astro`. React is confined
  to one island (`ChartSimulator`). Without this rule, the default output of "add an
  interactive section" is a React component on the critical path.
- **CLS = 0.00.** Variant copy resolves server-side from `Astro.url.searchParams` before
  serialisation. Never swapped client-side.
- **Brand tokens, never raw hex.** The palette lives in `tailwind.config.mjs`; components
  use token classes.

---

## 3. Development subagents

There are two, not a pod of four. A subagent earns its place when it carries constraints
that would otherwise have to be re-explained every time, or when the work benefits from a
clean context. Splitting the same job across four roles because it diagrams nicely adds
handoffs without adding capability.

### `experiment-copywriter`

Writes one `COPY_DICTIONARY` entry for a target ICP. Exists because copy generation is
where an unconstrained model does the most damage: it will cheerfully write "guaranteed
funded account" — a claim prop firms prohibit and that this audience reads as a scam
marker.

The agent carries the prohibited-claims list, the single-template rule (copy only, never
layout — otherwise a win is unattributable to the message), and the requirement that a
variant name one specific already-paid cost rather than a generic aspiration. Restricted
to file tools; it cannot touch the database or run the test.

### `analytics-auditor`

Read-only audit that exposures and conversions can actually be joined per arm.

Exists because of a specific, real failure: a broken telemetry join does not crash. It
reports a plausible 0% conversion rate for every non-control arm, and whoever reads that
concludes the variant lost. The agent checks the five joins that must hold (`variant_id`
agreement, `visitor_id` presence, server-only conversion counting, preview exclusion,
taxonomy completeness) and can run a dry evaluation to compare source against live data.

It is explicitly forbidden from editing. An auditor that fixes what it finds stops being
an independent check.

---

## 4. Skill and command

### Skill: `growth-experiment-analyzer`

The conversational counterpart to the runtime agent — for interrogating a result,
resolving an escalated experiment, or sanity-checking before acting.

Its most important instruction is a prohibition: **do not compute the statistics
yourself.** It routes every numeric question to `npm run eval-test -- --dry-run`, which
executes the real deterministic code in `src/lib/stats.ts`. A model asked to "check if
this is significant" will produce a confident, wrong p-value, and these numbers gate an
automated kill switch.

It also pins one decision vocabulary — `PROMOTE`, `KILL`, `HUMAN_REVIEW`, `CONTINUE` —
matching the `experiment_decisions.decision` column exactly, so the skill, the code, the
database and the admin UI cannot drift apart.

### Command: `/cro-experiment`

Scaffolds a new copy experiment: hypothesis, `COPY_DICTIONARY` entry, database arm, seed
row, verification.

Its verification step is the point. It requires confirming the treatment headline appears
in the **server-rendered HTML** via `curl`, not merely that the build passed — because the
tempting wrong implementation (a client-side flag read) also builds cleanly, and only
fails as a layout shift in front of paid traffic.

---

## 5. MCP integration

`.mcp.json` is committed with two servers, scoped to what is genuinely used when working
on this repo. Credentials come from the environment via `${VAR}` expansion; nothing
secret is committed.

| Server | Purpose |
| :--- | :--- |
| `posthog` | Ask questions of live telemetry without leaving the editor — "what did the funnel do on mobile yesterday" — during diagnosis and while validating the event taxonomy. |
| `neon-readonly` | Introspect `experiments`, `experiment_variants`, `users` and `experiment_decisions` while reasoning about a result. |

### Why the read-only role

`neon-readonly` expects `DATABASE_URL_READONLY`, not `DATABASE_URL`. An assistant
answering questions about the data has no business holding `UPDATE` on the table that
controls which copy live ad traffic receives. The application owns the write path; the
admin console and the evaluation agent are the only things that should mutate allocation,
and both are auditable through `experiment_decisions`.

```sql
CREATE ROLE claude_readonly WITH LOGIN PASSWORD '<generated>';
GRANT CONNECT ON DATABASE neondb TO claude_readonly;
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_readonly;
```

### Why the production agent does not use MCP

MCP is a protocol for connecting a **running assistant** to tools. The evaluation agent
is not an assistant — it is a cron job. Routing it through MCP would add a process to
spawn, a transport to fail, and a desktop-shaped dependency, in exchange for nothing: it
needs exactly two calls (a HogQL query and a Postgres write) and both are a `fetch` away.

```
DEVELOPMENT (MCP)                    PRODUCTION (no MCP)
Claude Code on a laptop              Vercel Cron, headless
  ├── posthog MCP ──► PostHog          ├── fetch ──► PostHog HogQL API
  └── neon-readonly ──► Neon (RO)      └── neon() driver ──► Neon (RW)
  Ad-hoc questions, diagnosis          Runs whether or not anyone is awake
```

**Sentry MCP is not configured.** An earlier draft of this document listed it; Sentry is
not part of this project, so claiming the integration would have been fiction. If error
monitoring were added, watching for variant-correlated exception spikes during rollout
would be the reason.

---

## 6. How the pieces fit together

```
   ┌─ development ────────────────────────────────────────────────┐
   │  /cro-experiment ──► experiment-copywriter ──► copy-dictionary│
   │         │                                                     │
   │         └──► analytics-auditor ──► verifies the join holds    │
   │                      ▲                                        │
   │           posthog MCP │ neon-readonly MCP                     │
   └──────────────────────┼────────────────────────────────────────┘
                          │
   ┌─ production ─────────┼────────────────────────────────────────┐
   │  Vercel Cron ──► src/lib/agent/                               │
   │                    1 collect  (PostHog REST + Neon)           │
   │                    2 decide   (stats.ts — deterministic)      │
   │                    3 diagnose (LLM — explains, cannot decide) │
   │                    4 act      (promote / kill / escalate)     │
   │                         │                                     │
   │                         ▼                                     │
   │              experiment_decisions ──► /marketingengine        │
   │                                            ▲                  │
   │  growth-experiment-analyzer skill ─────────┘                  │
   └───────────────────────────────────────────────────────────────┘
```

The load-bearing property is the **ordering inside the runtime agent**: statistics and
decision are fixed before the model is called. The LLM receives the verdict as a fact and
writes the explanation. A hallucinated sentence can embarrass a report; it cannot
reallocate traffic.

---

## 7. Where AI improved execution

- **Copy permutation.** Expanding one loss-aversion thesis into complete, schema-valid
  copy matrices across four ICPs — eyebrow, headline, subhead, CTA, four pillars, three
  testimonials each. Mechanical breadth over a human-chosen angle.
- **Schema and contract scaffolding.** PostgreSQL DDL, TypeScript interfaces and Zod
  contracts, kept consistent across `scripts/schema.sql`, `src/lib/schemas.ts` and the
  repository layer.
- **Statistical implementation.** Translating the pooled two-proportion Z-test and the
  Abramowitz & Stegun erf approximation into code — well-specified maths with a known
  correct answer, which is the safest possible delegation.
- **Breadth of the admin console.** Ten routes of CRUD, filtering and pagination is
  volume work where speed matters and correctness is easy to verify by clicking.

## 8. Where AI output was corrected or rejected

### Caught during implementation — verifiable in the diff

1. **Exposure and conversion events used different `variant_id` values.** The client
   stamped `COPY_DICTIONARY[key].variant_id` (`prop_firm_hunter`); the server stamped the
   raw `variant_key` (`1`). Any PostHog funnel would have reported **0% for every
   non-control arm** — a wrong answer that looks like a real one. Found by writing the
   HogQL join and asking what it would actually match. Fixed in `src/pages/api/users.ts`.

2. **Blank number inputs coerced to `0`.** `z.coerce.number()` turns `""` into `0`, so an
   untouched "baseline CR" field stored `0` rather than null. That collapsed the required
   sample size from 1,240 to **4 visitors per arm** — the agent would have declared
   significance on noise. Found by creating an experiment through the real form instead of
   trusting the schema. Fixed with a `preprocess` step in `src/lib/schemas.ts`.

3. **The spec's own sample-size arithmetic was wrong.** `AUTONOMOUS_EXPERIMENT_SERVICE.md`
   §2 states δ = 0.008 *and* concludes n ≈ 1,240. Those are inconsistent: δ = 0.008 yields
   7,744. Rather than copying the number or silently changing it, the code uses δ = 0.02
   (which does produce 1,240, the threshold the rest of the system is written against) and
   documents the discrepancy plus its real cost — this test is only powered for a +62%
   relative lift. See `src/lib/stats.ts`.

4. **Promoting a winner discarded the winner.** `winner_promoted` mapped to "not running",
   so `?lp=` traffic reverted to the control copy the variant had just beaten — the exact
   opposite of promotion. Found by clicking Promote and then loading the landing page.
   Fixed in `src/lib/experiment-repo.ts`; promoted experiments now serve the winning copy
   permanently and stop attributing traffic to a concluded test.

5. **Zero exposures rendered as a confident `0.00%` conversion rate** next to a non-zero
   signup count. The absence of a denominator was being displayed as a measurement. The
   collector now downgrades `metrics_source` to `database` when exposures are zero or
   fewer than conversions, and the decision engine refuses `PROMOTE` and `KILL` on
   unmeasured data — it escalates to a human instead.

6. **A form control named `action` shadowed `form.action`** in the DOM, so reading the
   form's target returned an input element instead of a URL. Renamed to `op`.

### Rejected at design time

- **"Guaranteed prop firm pass" copy.** Prop firms prohibit guarantee language and this
  audience reads it as a scam marker. Replaced with risk management, statistical edge and
  drawdown stress-testing. The constraint is now encoded in the `experiment-copywriter`
  agent so it does not have to be re-litigated.
- **Client-side A/B redirection** (`window.location.replace('/freetrial-variant-1')`).
  Splits SEO signals across URLs and flashes content. Replaced with single-template
  server-rendered query-parameter injection at `/freetrial?lp=1`.
- **Premature stopping** after a fixed conversion count. Replaced with an explicit MDE
  sample-size gate, so the "peeking problem" is structurally prevented rather than left to
  whoever is reading the dashboard.

### The general pattern

Every defect in the first list shares a shape: **the code ran, the build passed, and the
output was wrong in a way that looked plausible.** None would have been caught by type
checking or by reading the diff.

They were caught by executing the real path — creating an experiment through the actual
form, clicking Promote and then loading the page, writing the analytics join and asking
what it would match. That is the practical lesson from this build: with generated code,
review catches what looks wrong, and only exercise catches what *reads* right and is
false.
