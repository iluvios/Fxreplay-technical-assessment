# Deliverable 3: A/B Experiment Proposal

## 1. Experiment Overview
* **Experiment Name:** `EXP-2026-HERO-PROP-FIRM-ANGLE`
* **Target Audience:** All new visitors to `/` (50/50 split via PostHog feature flags).
* **Estimated Sample Size:** 12,000 unique visitors (achievable in ~7 days based on FX Replay's traffic).

---

## 2. Hypothesis
> *"If we pivot the primary hero headline from a generic caution angle ('Your Strategy Shouldn't Be Tested With Real Money') to a high-intent outcome angle tailored to Prop Firm Challenge traders ('Pass Your Next Prop Firm Challenge Before Risking Real Capital'), then **visitor-to-signup conversion will increase by at least 15%**, because modern retail Forex and Futures traders are overwhelmingly motivated by passing funded trader challenges (FTMO, FundedNext) rather than general practice."*

---

## 3. Test Setup

### Control (Baseline Experience)
* **Headline:** *"Your Strategy Shouldn’t Be Tested With Real Money"*
* **Value Angle:** Risk mitigation and loss avoidance.
* **CTA Button:** *"Try FX Replay Free"*

### Variant (Tested Experience)
* **Headline:** *"Pass Your Next Prop Firm Challenge Before Risking Real Capital"*
* **Value Angle:** Concrete financial upside, funded account readiness, and challenge rule practice.
* **CTA Button:** *"Start Free Challenge Replay"*

*(Note: In the implementation, you can test this live by appending `?variant=prop` to the URL).*

---

## 4. Success Metrics

### Primary Success Metric
* **Visitor-to-Account Creation Rate:**
  $$\text{Conversion Rate} = \frac{\text{Unique Users completing } \texttt{signup\_completed}}{\text{Unique Visitors assigned to Variant}}$$

### Secondary Guardrail Metrics
1. **Activation Rate:** % of signed-up users who simulate at least 1 trade within 24 hours (ensures lead quality doesn't degrade).
2. **Paid Upgrade Rate (14-Day Lagged):** % of trial accounts upgrading to Intermediate or Pro tiers.
3. **Core Web Vitals Impact:** Cumulative Layout Shift (CLS) must remain `< 0.01` with zero DOM flicker.

---

## 5. Decision Framework

| Outcome | Statistical Threshold | Action Taken |
| :--- | :--- | :--- |
| **Ship Variant** | Conversion lift $\ge +8\%$ with $\ge 95\%$ Bayesian statistical significance ($p < 0.05$) and neutral/positive activation rate. | Roll out Variant to 100% of global traffic. Remove control code from repository. |
| **Continue Test** | Trend is positive ($+3\%$ to $+7\%$) but sample size or confidence has not reached 95% threshold (avoid underpowered peeking). | Continue running experiment for an additional 7 days up to maximum sample size. |
| **Reject Variant** | Negative lift, or confidence interval crosses zero with $< 80\%$ probability to beat control, or activation rate drops significantly ($> -10\%$). | Immediately revert feature flag to Control. Document findings in team research repository. |
