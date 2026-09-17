---
description: Scaffold a new server-rendered copy experiment — a COPY_DICTIONARY entry, a database arm, and the seed row — without breaking the single-template rule or CLS.
---

# `/cro-experiment`

Scaffold a new growth experiment in this codebase.

## How variants actually resolve here — read this first

Assignment is **server-side**. `resolveLiveExperience()` in `src/lib/experiment-repo.ts`
reads `?lp=` during SSR, buckets the visitor by a deterministic FNV-1a hash of their
`fxr_vid` cookie, and serialises the chosen copy into the HTML before delivery.

**Do not use `analytics.getVariant()` to select copy.** It is a client-side PostHog
feature-flag read that exists only as a late fallback, and `copy-dictionary.ts` says so
explicitly: variants are resolved server-side, never in the browser. Selecting copy
client-side would swap text after paint — a layout shift, breaking the `CLS = 0.00`
requirement in `CLAUDE.md` §2.3 and the single-template rule this whole experiment
design depends on.

Two things are deliberately separated, and a new experiment touches both:

- **Copy** lives in code (`src/lib/copy-dictionary.ts`). Typed, reviewed, shipped with
  the build. Not editable from the admin UI.
- **Allocation** lives in the database (`experiments`, `experiment_variants`). Status,
  weights and active flags, so the admin console and the evaluation agent can change
  what traffic sees without a deploy.

## Steps

### 1. Define the hypothesis

Ask for, or infer, the target ICP. State the hypothesis in the form the registry uses:

> Framing the hero around **\<mechanism\>** converts better than **\<baseline\>** for
> **\<ICP\>**, because **\<the pain they have already paid for\>**.

A hypothesis that does not name a mechanism and a reason is not testable. Push back
rather than scaffolding one.

Pick the `?lp=` value (the experiment id — human-readable, goes in ad URLs) and the
`variant_key` (the `COPY_DICTIONARY` key for the treatment arm).

### 2. Add the copy

Add one entry to `COPY_DICTIONARY` keyed by `variant_key`, matching the
`ExperimentVariantCopy` interface exactly — `eyebrow`, `hero` (headline, subheadline,
cta_text, cta_subtext, hero_image_type), `feature_tab`, four `pillars`, three `reviews`,
and `modal`.

Constraints that are not negotiable:

- **Single template.** Copy only. Do not fork a component, change layout, reorder
  sections or restyle anything. If the layout differs between arms you cannot attribute
  a win to the message, which is the only thing this test is measuring.
- **`hero_image_type`** must be one of the four keys in `HERO_VISUAL_BY_TYPE`.
- **No prohibited claims.** Never imply guaranteed funding, guaranteed challenge passes,
  or specific profit outcomes. Prop firms ban those claims and the audience reads them
  as scam markers. Frame around risk management, statistical edge and rule simulation.
- Consider **delegating this step** to the `experiment-copywriter` agent, which carries
  the persona constraints and the banned-claims list.

### 3. Register the experiment

Either through the admin console at `/marketingengine/experiments` (which creates the
control arm automatically and rejects a `variant_key` that has no copy), or by adding
the rows to `scripts/seed.sql` so a fresh database comes up with the experiment present.

Do both if the experiment should survive a re-seed. Keep `scripts/seed.sql` and
`src/lib/experiments.ts` consistent — the static registry is the fallback when the
database is unreachable.

Set `baseline_cr` explicitly. Leaving it blank means the sample-size target falls back
to the 3.2% product default rather than this surface's real baseline.

### 4. Verify before claiming it works

Do not report success on a build alone.

```bash
npm run build
```

Then exercise both arms and confirm the copy is in the server-rendered HTML, not swapped
in afterwards:

```bash
curl -s "http://localhost:4321/freetrial?lp=<id>&variant=<variant_key>" | grep -o "<h1[^>]*>[^<]*"
```

The treatment headline must appear in that response body. If it only appears after
hydration, the assignment is happening client-side and step 2 was done wrong.

Check the admin detail page at `/marketingengine/experiments/<id>` — the copy diff table
should show both arms side by side, and the arms should read `2/2 active`.

### 5. Confirm the analytics join

The single most expensive bug in this system is an experiment whose exposures and
conversions cannot be joined, because it reports 0% for every non-control arm and looks
like a real result.

Both sides must stamp the **same** `variant_id` — `COPY_DICTIONARY[key].variant_id`:

- client exposure: `experiment_variant_exposed` in `src/components/LandingPage.astro`
- server conversion: `signup_completed` in `src/pages/api/users.ts`

Run the `analytics-auditor` agent to verify this rather than eyeballing it.
