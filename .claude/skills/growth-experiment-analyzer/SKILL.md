---
name: growth-experiment-analyzer
description: Evaluates active A/B experiments by computing two-tailed Z-tests, sample size gating, and AI diagnosis against ICP definitions.
---

# Growth Experiment Analyzer Skill

## Overview
This reusable skill enables Claude Code to evaluate active marketing experiments, check statistical significance, and recommend whether to **Ship**, **Continue**, or **Kill** a variant.

## Instructions
When evaluating an experiment:
1. Extract sample sizes ($N_c$, $N_v$) and conversion counts ($X_c$, $X_v$) for Control and Variant.
2. Verify that both arms have reached the Minimum Detectable Effect (MDE) sample size ($n \ge 1,240$).
3. Compute the pooled proportion and Z-score:
   $$Z = \frac{\hat{p}_v - \hat{p}_c}{\sqrt{\hat{p}(1-\hat{p})\left(\frac{1}{N_v} + \frac{1}{N_c}\right)}}$$
4. Determine significance:
   - If $|Z| \ge 1.96 \implies p < 0.05$ (95% confidence).
   - If $|Z| \ge 2.58 \implies p < 0.01$ (99% confidence).
5. Cross-reference results with the defined ICP profile in `docs/ICP_PROFILES.md`.
6. Return structured output:
   - `decision`: "SHIP_WINNER" | "CONTINUE_TESTING" | "KILL_UNDERPERFORMER"
   - `relative_lift_pct`: Percentage lift
   - `confidence_pct`: Confidence level
   - `qualitative_diagnosis`: Explanation based on ICP psychology
