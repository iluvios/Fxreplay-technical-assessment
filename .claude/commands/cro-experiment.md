---
description: Automatically scaffolds an A/B test variant for an Astro/React growth component with PostHog feature flag integration and analytics instrumentation.
---

# Reusable Skill: `/cro-experiment`

Use this skill when proposing or scaffolding a new growth experiment in the FX Replay codebase.

## Workflow Execution Steps:

1. **Hypothesis Definition:**
   - Ask the user or read the issue for the target component (e.g., `InteractiveHero.tsx` or `PricingSection.astro`).
   - Define:
     - `experiment_id`: e.g., `exp_pricing_cta_v2`
     - `control`: Baseline copy/layout
     - `variant_a`: New tested hypothesis
     - `primary_metric`: e.g., `signup_completed`

2. **Feature Flag Integration:**
   - Ensure the variant query checks `analytics.getVariant(experiment_id)`.
   - Ensure `analytics.track('experiment_variant_exposed', { experiment_id, variant_id })` is fired on mount.

3. **Accessibility & Core Web Vitals Guard:**
   - Verify that the variant does NOT introduce layout shifts (CLS must remain `< 0.01`).
   - Ensure all interactive buttons have explicit `aria-label` tags.

4. **Self-Verification:**
   - Run `npm run build` to confirm zero TypeScript compilation errors.
