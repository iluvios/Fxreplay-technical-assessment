---
name: growth-experiment-analyzer
description: Evaluates active A/B experiments by computing two-tailed Z-tests, sample size gating, and AI diagnosis against ICP definitions. Use when asked to analyse experiment results, decide whether to ship or kill a variant, or interpret a decision the autonomous agent already made.
---

# Growth Experiment Analyzer

Interactive counterpart to the autonomous evaluation agent in `src/lib/agent/`.

The agent runs headless on a cron and decides. This skill is for the conversation that
happens *after* a decision — when a growth engineer wants to interrogate the numbers,
resolve an escalated experiment, or sanity-check a result before acting on it.

## Non-negotiable: do not compute the statistics yourself

The thresholds below describe what the code does. **Never hand-calculate a Z-score or a
p-value to answer a question about a live experiment.** An LLM will produce a confident,
wrong p-value, and these numbers gate an automated kill switch.

Get the real numbers by running the pipeline:

```bash
npm run eval-test -- --dry-run --experiment <id>
```

A dry run computes and reports everything, writes nothing, and changes no traffic. The
implementation is `src/lib/stats.ts` (pure, deterministic) and `src/lib/agent/decide.ts`
(the rules). Read those rather than reasoning from memory.

## Decision vocabulary

One vocabulary, used by the code, the database, the admin UI and this skill. Do not
invent synonyms — `experiment_decisions.decision` stores exactly these four values.

| Decision | Fires when | Effect on live traffic |
| :--- | :--- | :--- |
| `PROMOTE` | powered, `p < 0.05`, lift `>= +15%` | Winning arm takes 100% of the split; experiment closes as `winner_promoted` |
| `KILL` | `n >= 500` per arm, lift `<= -25%`, `p < 0.10` | Arm deactivated; its traffic reverts to control |
| `HUMAN_REVIEW` | `p` in `[0.05, 0.15]`, or significant-but-under-15%, or no measured exposure data | None — escalated with action links |
| `CONTINUE` | underpowered and not close, or powered with no signal | None — test keeps running |

The kill gate is deliberately looser than the promote gate (`p < 0.10` vs `p < 0.05`).
The costs are asymmetric: a false kill wastes a little learning and reverses in one
click, a false promote reshapes the whole funnel. If asked to justify this, that is the
reason — not a mistake.

## Sample size

`n >= 1,240` visitors per arm, from `16·p·(1-p) / δ²` at `p = 0.032`, `δ = 0.02`.

Be precise about what that buys: δ = 0.02 is a **2 percentage-point** MDE, which at a
3.2% baseline is a **+62% relative lift**. This test is not powered to detect subtler
moves. Detecting a +25% relative lift (δ = 0.008) needs ~7,700 visitors per arm.

> `docs/AUTONOMOUS_EXPERIMENT_SERVICE.md` §2 states δ = 0.008 *and* n ≈ 1,240. Those are
> inconsistent — δ = 0.008 yields 7,744. The code keeps the 1,240 threshold the rest of
> the system is written against and documents the discrepancy in `src/lib/stats.ts`.

## When exposure data is missing

If PostHog reports zero exposures, or more conversions than exposures, there is no valid
denominator and **every conversion rate is fiction**. The collector downgrades
`metrics_source` to `database` and the decision engine refuses `PROMOTE` and `KILL`,
returning `HUMAN_REVIEW` instead.

Do not work around this by estimating visitors from traffic weights. Say the denominator
is missing and what would restore it.

## Interpreting a result against the ICP

Once the numbers are in hand, the qualitative half is the actual value-add. Read the
target persona from the `icps` table (`core_pains`, `core_desires`, `primary_emotion`)
and the copy under test from `src/lib/copy-dictionary.ts`, then explain the *mechanism*:
which specific pain the winning headline names, and why that beat the alternative.

Ground every claim in the copy that ran. "The variant resonated better" is not a
diagnosis; "the variant names a recurring $300 loss the persona has already paid, which
the control's generic risk framing does not" is.

## Output shape

When reporting a verdict, give:

- `decision` — one of the four values above
- `relative_lift_pct`, `p_value`, `confidence_pct`, `sample_target` — copied from the
  pipeline output, never recomputed
- `diagnosis` — the mechanism, grounded in ICP and copy
- `next_step` — one concrete action
