# FX Replay — Growth Engineer Technical Challenge

**Johan Daniel Álvarez**
Live: [fxreplay-technical-assessment.vercel.app](https://fxreplay-technical-assessment.vercel.app/)
Code: [github.com/iluvios/Fxreplay-technical-assessment](https://github.com/iluvios/Fxreplay-technical-assessment)

Astro 5 · React 19 · Tailwind · TypeScript · Neon Postgres · PostHog · Vercel

> **Scope & Timebox Note:** Built within an approximate 6.5-hour timebox. The depth of this implementation (full-stack SSR, database persistence, an admin console, and an autonomous evaluation loop) was achieved by treating Claude Code as an active engineering multiplier rather than a code-completion tool — demonstrating the exact autonomous AI-native execution capacity this role demands.

---

## What this is

A landing page that changes its message depending on who the visitor is, plus the
machinery to prove whether that actually works: an internal console for running the
tests, and a robot that checks the results twice a day and acts on them.

Three parts:

1. **The public page** — one design, different copy per audience, decided on the server
   so there's no flicker.
2. **The admin console** (`/marketingengine`) — see who signed up, create and manage
   experiments, watch what the robot decided.
3. **The evaluation agent** — a scheduled job that pulls the numbers, does the
   statistics, asks an AI to explain the result, then promotes the winner, kills the
   loser, or asks a human.

---

## Running it

```bash
git clone https://github.com/iluvios/Fxreplay-technical-assessment.git
cd Fxreplay-technical-assessment
npm install
npm run dev
```

Open `http://localhost:4321`. It runs with no database — there's an in-memory fallback
so nothing needs setting up to look around. Add a `DATABASE_URL` and run
`npm run db:migrate` to use real Postgres.

**Admin console:** `/marketingengine` — username `admin`, password `fxreplay`.

### The pages

| Route | What it does |
|---|---|
| `/` and `/freetrial` | The landing page, baseline message |
| `/freetrial?lp=1` | Experiment for prop-firm traders — three competing messages vs the baseline |
| `/freetrial?lp=2` | Experiment for time-poor professionals |
| `/freetrial?lp=3` | Experiment for technical traders who already pay for charting |
| `/signup` | The signup form (a real page, not a popup) |
| `/marketingengine` | Admin console — overview, experiments, users, agent |
| `/api/users` | Create and list signups |
| `/api/engine/evaluate` | Triggers the evaluation agent |

### Useful commands

```bash
npm run db:status                  # what's in the database
npm run db:report                  # signups by experiment arm and by channel
npm run eval-test -- --dry-run     # run the agent, change nothing
```

---

## 1. How it's built, and why

### One design, different words

Every version of the page uses the same layout, same components, same styling. Only the
words change.

This is the most important decision in the whole project. If two versions of a page
differ in layout *and* copy and one wins, you've learned nothing — you don't know which
change caused it. Locking the design means a win is always attributable to the message.

### The message is chosen on the server

When someone lands on `?lp=1`, the server decides which version they get and writes that
copy into the HTML before sending it. The browser receives the finished page.

The tempting alternative is to send one page and swap the text in JavaScript once it
loads. That's much easier, and it's wrong: the visitor sees the old headline flash and
get replaced. Google measures that flicker (it's called layout shift), it lowers your ad
quality score, and it makes the page feel cheap. Doing it on the server means zero
flicker — measured CLS is 0.00.

### Almost no JavaScript

Astro sends plain HTML and CSS by default. The navigation, hero, feature tabs, pricing
and footer ship **zero JavaScript**. Only one component is interactive — the chart
simulator — and it loads on its own after the page is already usable.

A React framework would have shipped its whole runtime just to render text that never
changes. On mobile that's bandwidth taken from the things that actually need it.

### Signup is a page, not a popup

Popups can't be linked from an ad, break the back button, and are awkward on phones. A
real page at `/signup?lp=1` can be the direct destination of an ad, keeps browser
history clean, and carries the experiment assignment with it.

### Design choices that serve the conversion

Working inside the existing brand — the near-black surfaces, electric blue, Lato and
Nunito Sans, JetBrains Mono for anything numeric — rather than inventing a new direction.

**The headline splits into setup and payoff.** Several variants are written as a turn:
*"Most evaluations aren't lost on strategy. They're lost on the daily drawdown."* The
second sentence renders in brand blue, so the turn lands visually as well as verbally.
Headlines without an internal break render normally — the layout never requires the copy
to have a particular shape.

**A faint chart grid behind the hero**, pure CSS, fading out before it reaches the text.
It makes the page read as a trading surface instead of a generic SaaS page, costs no
image request, and can't shift the layout.

**A second path for people who want proof before a form.** Not everyone is ready to sign
up on arrival. "Try the replay first" scrolls to the interactive simulator already on the
page — which costs nothing to offer and keeps a sceptical visitor on the page instead of
bouncing.

**The signup page continues the argument.** It carries the same eyebrow, the two benefit
cards the visitor just read, and a testimonial from the matching audience. It answers the
four unspoken objections at the moment of commitment — what does it cost, is the data
real, do I have to do the boring part, can I leave. Previously it dropped the pitch
entirely and showed a bare form, which is where funnels leak.

The asset band under the hero lists real product coverage rather than simulated ticker
prices. Fake live numbers would look convincing to this audience for about two seconds.

### The database decides what's live, the code decides what it says

A deliberate split:

- **The words** live in code (`src/lib/copy-dictionary.ts`) — reviewed, type-checked,
  shipped with the build. Not editable from the admin UI.
- **Who sees what** lives in the database — which experiments are running, traffic
  split, which arms are switched on.

So marketing copy goes through code review, but pausing an experiment or killing a bad
variant happens instantly from the console, with no deploy. That split is what makes the
automated agent possible at all.

### If it breaks, the signup still works

If the database is unreachable, the app falls back to in-memory storage rather than
failing. You lose some analytics fidelity; you don't lose the customer. That's the right
trade for a page whose entire job is conversion.

### What I'd change for real production

- Hash passwords. They're stored as plain text here because it's a simulated signup —
  this is called out in the schema and would obviously never ship.
- Real authentication on the admin console — SSO, not a hardcoded password.
- Rate limiting on the signup and telemetry endpoints.
- Connection pooling in front of Postgres for traffic spikes around news events.

---

## 2. Measuring it

Analytics runs on PostHog.

**Events go through our own domain.** Requests route through `/ingest` on our origin
rather than straight to PostHog. Ad blockers block PostHog's domain, and the people most
likely to run an ad blocker are exactly the technical traders this product targets — so
that data loss isn't random, it's biased against the audience we care about.

**The conversion event is sent by the server, not the browser.** When an account is
created, the server records it. A browser event can be blocked, or lost if someone
closes the tab during the redirect. The number that decisions are based on has to be the
one that can't go missing.

### What gets tracked

| Event | When |
|---|---|
| `landing_page_viewed` | Page loads |
| `experiment_variant_exposed` | Visitor enters a running experiment |
| `cta_button_clicked` | Any call-to-action clicked (records which one) |
| `backtest_preview_interacted` | First interaction with the chart |
| `signup_page_viewed` | Signup page loads |
| `signup_form_started` | First field focused |
| `signup_form_submitted` | Form submitted |
| `signup_completed` | Account actually created — **sent by the server** |
| `signup_error_encountered` | Validation or network failure |

Every event carries the acquisition channel and campaign, so any funnel can be split by
where the traffic came from without joining to another table.

**The main number:** unique visitors who create an account ÷ unique visitors who saw the
page.

### Where attribution comes from

Ad networks strip URL parameters sometimes. So the experiment assignment is recovered in
order: the `?lp=` parameter, then the campaign name, then a 30-day cookie set on first
visit. A signup gets attributed even when the link that produced it was mangled.

---

## 3. The experiments

Three experiments, one per audience. Each runs **three competing messages against the
same generic control** — the message people would otherwise have seen. So every test
asks one question: does speaking to this audience specifically beat speaking to everyone?

Each arm tests exactly **one psychological mechanism**. Stacking two into a single arm
makes a win unattributable, which defeats the purpose.

### Experiment 1 — Prop firm evaluation traders (`?lp=1`)

They lose $150–600 every time they fail an evaluation, and 95% of them fail. That's a
real, repeated, recent cost.

| Arm | Headline | Mechanism |
|---|---|---|
| Control | Your strategy shouldn't be tested with real money | Generic baseline |
| A (`prop_fees`) | Every failed evaluation costs $300. **This one costs nothing.** | Sunk cost — names money already lost |
| B (`prop_rules`) | Your strategy didn't fail the challenge. **Your trailing drawdown did.** | Diagnosis — trailing drawdown on unrealised equity |
| C (`prop_funded`) | Blow the account here first. **Resets are free.** | Earned confidence — $0 resets |

### Experiment 2 — Time-poor professionals (`?lp=2`)

Good jobs, capital to trade, no hours. The markets are closed exactly when they're free.

| Arm | Headline | Mechanism |
|---|---|---|
| Control | Your strategy shouldn't be tested with real money | Generic baseline |
| A (`weekend_year`) | A year of London opens, compressed into one Sunday. | Time compression — London open at your time |
| B (`weekend_reps`) | Two setups a week is a six-year education. **Compress it.** | The repetitions maths |
| C (`weekend_career`) | Build the screen time your day job keeps stealing from you. | Screen time without salary risk |

### Experiment 3 — Technical traders who already pay for charting (`?lp=3`)

Sophisticated, allergic to marketing language, and already paying someone else. Every
claim here is one they can verify themselves in a few minutes.

| Arm | Headline | Mechanism |
|---|---|---|
| Control | Your strategy shouldn't be tested with real money | Generic baseline |
| A (`tv_bias`) | Your replay engine has already seen the next candle. | Invalidation — accuses engine of lookahead bias |
| B (`tv_precision`) | Stop guessing whether your stop or your target hit first. | Measurement precision — ambiguous wick fills |
| C (`tv_journal`) | A backtest that saw the candle first isn't a backtest. | Integrity — synchronised MTF stepping with zero leak |

### What's held constant, and why it matters

Within an experiment, **only the hero and signup copy change**. The feature descriptions,
the four benefit cards and the testimonials are identical across all four arms.

This is the single-design rule applied to the words themselves. If the headline, the
benefits and the social proof all changed together, a win would tell you one bundle beat
another bundle — not which message did the work. Everything runs through a small shared
base per audience so this can't drift by accident.

Traffic splits evenly. Which arm someone gets is decided by hashing their anonymous ID,
so they see the same version on every visit — otherwise one person's journey splits
across arms and the numbers stop meaning anything.

### The cost of running three at once

Three arms find a winner in one cycle instead of three sequential tests, which matters
when each cycle needs ~1,240 visitors per arm.

The price is that three arms get three chances to look like a winner by luck — roughly a
14% chance one clears the usual bar when none of them actually works. So the agent
tightens the bar in proportion (a Šidák correction: 0.05 becomes about 0.017 with three
arms). An arm that would have won a two-arm test but doesn't clear the corrected bar gets
escalated to a human rather than promoted or silently ignored.

### How long it needs to run

- Baseline conversion: 3.2%
- Confidence required: 95%
- **Needs about 1,240 visitors per arm**, and at least 7 full days so weekday and weekend
  traffic are both represented.

**An honest caveat:** 1,240 visitors per arm is only enough to reliably detect a fairly
large improvement — roughly +62% relative. Detecting a subtler +25% improvement would
need about 7,700 per arm. The brief's spec stated both a small target effect *and* the
1,240 figure, which don't agree with each other; I kept 1,240 (the number the rest of the
system is built around) and documented what it actually buys rather than quietly
inheriting a misleading number.

### What happens at the end

- **Ship it** if the variant is at least 15% better and the result is statistically solid.
- **Kill it** if it's 25% or more *worse* — stop wasting ad spend immediately.
- **Ask a human** if it's close to significant but not there, or if the data looks wrong.
- **Keep running** if there just isn't enough data yet.

---

## 4. The admin console

At `/marketingengine`. Four screens, no client-side JavaScript at all — every action is a
normal form submission.

**Overview** — how many experiments are running, how many signups, how many are
attributed to a test, and what the agent last decided.

**Experiments** — list everything, create a new test. Each experiment has a detail page
showing:
- current conversion rates and whether the result is significant yet
- the arms, with traffic weights, an on/off switch, and a promote button
- the copy of every arm side by side, so you can see what's actually being tested
- the full history of every decision the agent has made about it

**Users** — every signup, filterable by search, channel, stated trading goal, or
experiment. Crucially it shows *which message* converted each person, so you can trace a
customer back to the ad and the headline that got them.

**Agent** — what the robot is configured to do, whether its dependencies are connected,
and the complete decision log.

Turning off an arm here takes effect on the next page load. That's not cosmetic — it's
the same mechanism the agent uses to stop a losing variant.

---

## 5. The evaluation agent

The problem this solves: experiments get forgotten. A variant quietly underperforms for a
week while ad budget burns, or someone checks too early, sees a promising number, and
ships something that was noise.

A scheduled job runs and does four things in this order:

**1. Collect** — pull exposure and conversion counts per arm from PostHog, and verified
account rows from the database.

**2. Calculate** — run the statistics in plain, deterministic code. Sample size check,
then a standard significance test.

**3. Explain** — hand the finished numbers to an AI model along with the audience profile
and the actual headlines, and ask it *why* the result looks like this.

**4. Act** — promote the winner, kill the loser, escalate to a human, or leave it running.

### The one design decision that matters here

**The maths happens before the AI is involved, and the AI cannot change it.**

An AI asked "is this significant?" will give you a confident, plausible, wrong answer.
That number would be wired directly to a switch that reallocates real ad traffic. So the
statistics are ordinary code with a known correct answer, the decision is made by explicit
rules, and only then does a model get asked to write the explanation. A bad sentence can
embarrass a report. It cannot touch the traffic.

### It refuses to act on bad data

If the analytics show no page views but some signups, that's impossible — something is
broken. Rather than reporting a confident "0% conversion rate", the agent recognises the
data is untrustworthy, refuses to promote or kill anything, and escalates to a human.

Everything it does is written to an audit log, including the runs where it decided to do
nothing. Anything that can pause live traffic has to be reconstructable afterwards.

### Running it

```bash
npm run eval-test                                      # evaluate everything live
npm run eval-test -- --dry-run                         # calculate, change nothing
npm run eval-test -- --dry-run --fixture 3420,110,3580,172
```

That last one feeds made-up numbers through the real pipeline so you can watch the
promote and kill logic fire before there's enough real traffic to trigger them. It only
works in dry-run mode — invented numbers can never move real traffic.

---

## 6. Working with AI

### Project rules

`CLAUDE.md` at the repo root is a constraint file every AI session inherits: don't invent
copy (the specs already exist), keep marketing sections at zero JavaScript, resolve
variants on the server, use the brand colour tokens rather than raw hex codes.

Most of the value is in the *prohibitions*. Left alone, a model writing growth code will
cheerfully add a React component to a static page and invent marketing claims nobody
approved.

### Two specialist agents

- **`experiment-copywriter`** — writes a new message variant. Carries the banned-claims
  list (no guaranteed funding, no promised returns — prop firms prohibit that language
  and traders read it as a scam signal) and the single-design rule. Can edit files, can't
  touch the database.
- **`analytics-auditor`** — read-only. Checks that page views and signups can still be
  matched up per arm. Deliberately can't fix what it finds; an auditor that edits code
  stops being an independent check.

I wrote two rather than a larger set. A specialist agent earns its place when it carries
rules that would otherwise need re-explaining every time — not because more boxes make a
better diagram.

### A skill and a command

- **`growth-experiment-analyzer`** — for discussing results. Its most important rule is a
  ban: never calculate the statistics yourself, always run the real code.
- **`/cro-experiment`** — scaffolds a new experiment, and makes you verify the new copy is
  in the server's HTML rather than just checking the build passed. The wrong
  implementation also builds cleanly.

### MCP

`.mcp.json` connects PostHog and the database to the editor for asking questions while
building. The database connection is **read-only** — something answering questions about
the data has no business being able to change which copy live traffic sees.

The production agent deliberately does *not* use MCP. MCP connects a running assistant to
tools; the agent is a scheduled job that needs two API calls and must work whether or not
anyone's laptop is open.

### Where AI genuinely helped

Expanding one messaging idea into complete, valid copy for four audiences. Writing the
database schema and validation contracts consistently across several files. Implementing
the statistical formulas — well-defined maths with a known right answer is the safest
thing to delegate. And the sheer volume of the admin console: ten screens of forms and
tables where speed matters and mistakes are obvious on sight.

### Where I had to correct it

These are the useful ones, because they share a pattern: **the code ran, the build
passed, and the answer was wrong in a way that looked completely reasonable.**

1. **The analytics couldn't be joined.** The browser labelled each page view with one ID
   and the server labelled each signup with a different one. Every report would have shown
   0% conversion for every variant — a wrong answer that looks like a real one. Found by
   writing the query and asking what it would actually match.

2. **An empty form field became zero.** Leaving "baseline conversion rate" blank stored 0
   instead of nothing, which made the required sample size collapse from 1,240 visitors to
   **4**. The agent would have declared a winner based on almost no data. Found by
   actually creating an experiment through the form instead of trusting the code.

3. **The spec's own arithmetic didn't add up.** The sample-size figure and the target
   effect in the brief contradicted each other. Rather than copying the number or silently
   changing it, I corrected it and wrote down what it really means.

4. **Promoting a winner threw the winner away.** Clicking "promote" marked the experiment
   finished, which made the page revert to the losing copy — the exact opposite of the
   intent. Found by clicking the button and then looking at the page.

5. **Missing data displayed as a real measurement.** With no page views recorded, the
   dashboard showed a confident "0.00% conversion rate" next to real signups. Absence was
   being rendered as a fact.

**The lesson:** with AI-generated code, reading the diff catches what looks wrong. Only
running the real path catches what *reads* right and is false. Every one of these came
from clicking the actual button, not from review.

### Judgment I kept for myself

The loss-aversion angle — that prop traders have a specific dollar figure they've already
lost — came from reading how these traders actually talk. Prompted generically, a model
produces "become a master trader."

Same for the single-design rule, and for insisting the statistics sit outside the AI. Those
are the decisions that determine whether any of the rest is trustworthy.

---

## 7. Performance and production

### Real measured scores

PageSpeed on the live Vercel deployment:

- **Desktop: 99** — LCP 0.5s, CLS 0.00, blocking time 0ms
- **Mobile: 77** — LCP 4.1s, CLS 0.00, blocking time 0ms

**Mobile is 77 and I chose to leave it there.** The single remaining bottleneck is the
Google Fonts stylesheet, worth roughly 300–700ms. Fixing it means copying eight font
files into the repo and maintaining them. For an assessment build I judged that a poor
trade — the layout shift score is already perfect, nothing is janky, and the fix is
mechanical rather than interesting. It's a deliberate call, not an oversight, and I'd make
the opposite call on a page actually receiving paid traffic.

### What's already optimised

- Fonts load without blocking the first paint.
- The analytics SDK (~300KB) loads only when the browser is idle, never during first
  paint.
- The chart component hydrates on its own schedule.
- Images have explicit dimensions so nothing reflows.

### SEO and accessibility

One `<h1>` per page, proper semantic sections, structured data for search engines, and a
canonical URL shared across all variants so the different `?lp=` versions don't compete
with each other in search results.

Body text sits at 13:1 contrast (well past the AAA standard). The feature tabs are native
radio inputs, so they work with a keyboard for free. Form fields have real labels and
proper error messaging.

### Risks I planned for

| Risk | What I did |
|---|---|
| Ad blockers eating the data | Analytics through our own domain; conversion recorded server-side |
| Ad networks stripping URL parameters | Three-layer fallback — parameter, campaign name, cookie |
| Traffic spikes on news events | Nothing holds state; scales with the platform |
| Calling a test too early | Sample-size gate enforced in code, before significance is even calculated |
| The agent making a bad call | Both automatic actions reverse in one click, and everything is logged |

---

## 8. Strategic trade-offs and deliberate cuts

### What I prioritized, and why

- **Architecture over design complexity:** I deliberately didn't build an overly intricate or novel visual design. If an existing design works, the engineering priority is to systematically measure and improve it. Locking down a clean, consistent layout avoided confounding visual variables and kept the focus where growth leverage actually lies: robust technical architecture that isolates copy performance.
- **Fast ICP experimentation at scale:** I believe hyper-personalized messaging tailored to specific customer profiles is what truly moves conversion numbers. I prioritized the technical foundation that makes testing those messages fast, reliable, and scalable — zero-CLS server-side routing, first-party telemetry that bypasses ad blockers, and an autonomous evaluation loop.
- **Copywriting calibration vs. domain mastery:** Not being an active FX/futures trader myself, I recognized that my domain intuition wouldn't match a ten-year veteran out of the gate. Rather than relying on generic SaaS buzzwords, I focused on researching authentic retail trader mechanics (trailing drawdown on unrealised equity, intrabar tick skipping, session time constraints) to achieve a solid, credible baseline, while structuring the copy dictionary so domain experts and copywriters can iterate instantly without code changes.

### What was deliberately left out or simplified

- **Passwords are plain text.** Deliberate for a simulated signup challenge, explicitly flagged in the schema.
- **Admin login is a hardcoded password.** A real deployment would put this behind company SSO; building half a login system would be effort spent on the one part guaranteed to be thrown away.
- **Scroll depth and time-on-page aren't collected.** The database has columns for them and the design references them, but nothing populates them yet. I'd rather say that than show an empty chart implying otherwise.

---

## Where things live

| | |
|---|---|
| Page copy for every variant | `src/lib/copy-dictionary.ts` |
| Who sees which variant | `src/lib/experiment-repo.ts` |
| The statistics | `src/lib/stats.ts` |
| The agent, in four stages | `src/lib/agent/` |
| Database schema | `scripts/schema.sql` |
| Admin console | `src/pages/marketingengine/` |
| AI setup | `CLAUDE.md`, `.claude/`, `.mcp.json` |
