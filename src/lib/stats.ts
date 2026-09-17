/**
 * Frequentist statistics for two-arm conversion tests.
 *
 * Every number the evaluation agent acts on is computed here, before any model is
 * invoked. An LLM asked to "check if this is significant" will produce a confident
 * p-value that is simply wrong, and a wrong p-value routed into an automated kill
 * switch destroys a winning variant silently. So the maths is deterministic, pure,
 * and unit-checkable; the model only gets to explain numbers it did not produce.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §2 (Statistical Gatekeeper).
 */

/** Two-tailed critical value at 95% confidence. */
export const Z_CRITICAL_95 = 1.96;

/**
 * Minimum detectable effect the test is powered for, in absolute conversion-rate points.
 *
 * NOTE ON THE SPEC: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §2 states δ = 0.008 and
 * concludes n ≈ 1,240 per arm. Those two are inconsistent — 16·0.032·0.968 / 0.008²
 * is 7,744, not 1,240. The 1,240 figure is what you get at δ = 0.02, and 1,240 is the
 * threshold the rest of the system is written against (the decision matrix's "n ≥ 1,200"
 * and .claude/skills/growth-experiment-analyzer). So δ = 0.02 is used here, which keeps
 * the documented threshold intact.
 *
 * What that buys, stated plainly: at a 3.2% baseline this test is powered to detect a
 * 2pp move — a +62% relative lift. Anything subtler will read as underpowered until far
 * more traffic accumulates. Detecting a +25% lift (δ = 0.008) would need ~7,700 visitors
 * per arm; set `mde` explicitly on `evaluateTest` when that is the question being asked.
 */
export const DEFAULT_MDE_ABSOLUTE = 0.02;

/** Baseline conversion rate used for sample-size planning when the experiment has none. */
export const DEFAULT_BASELINE_CR = 0.032;

export interface ArmCounts {
  /** Unique visitors exposed to this arm. */
  visitors: number;
  /** Conversions on the primary metric. */
  conversions: number;
}

export interface TestResult {
  control: ArmCounts;
  variant: ArmCounts;
  /** Conversion rate as a proportion in [0, 1]. */
  control_cr: number;
  variant_cr: number;
  /** Relative lift of variant over control, in percent. Null when control has no data. */
  relative_lift_pct: number | null;
  /** Absolute difference in conversion rate, in percentage points. */
  absolute_lift_pp: number;
  /** Two-proportion pooled Z statistic. Null when either arm is empty. */
  z_score: number | null;
  /** Two-tailed p-value. Null when z_score is null. */
  p_value: number | null;
  /** (1 - p) as a percentage — how the result reads in a dashboard. */
  confidence_pct: number | null;
  /** True when |Z| >= 1.96. */
  is_significant: boolean;
  /** Visitors required per arm to detect DEFAULT_MDE_ABSOLUTE at 95%/80% power. */
  sample_target: number;
  /** True while either arm is below sample_target. */
  is_underpowered: boolean;
  /** Visitors still needed on the slower arm. Zero once powered. */
  remaining_visitors: number;
}

/** Conversion rate as a proportion, guarding division by zero. */
export function conversionRate({ visitors, conversions }: ArmCounts): number {
  return visitors > 0 ? conversions / visitors : 0;
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation
 * (|error| < 1.5e-7). Node has no built-in erf, and pulling a stats package in for
 * one function is not worth the dependency surface on a serverless cold start.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/** Two-tailed p-value for a Z statistic. */
export function twoTailedPValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Visitors required per arm, using the standard two-proportion approximation
 * n = 16·p·(1-p) / δ² (95% confidence, 80% power).
 *
 * The 16 folds (z_{α/2} + z_β)² ≈ (1.96 + 0.84)² ≈ 7.85, doubled for two arms.
 */
export function requiredSampleSize(
  baselineCr: number = DEFAULT_BASELINE_CR,
  mde: number = DEFAULT_MDE_ABSOLUTE
): number {
  const p = Math.min(Math.max(baselineCr, 0.0001), 0.9999);
  const delta = Math.max(Math.abs(mde), 0.0001);
  return Math.ceil((16 * p * (1 - p)) / (delta * delta));
}

/**
 * Two-tailed pooled Z-test for a difference in proportions.
 *
 * Pooled (rather than unpooled) standard error is the correct choice here: under the
 * null hypothesis both arms share one conversion rate, so the variance estimate should
 * too. The unpooled form is slightly more permissive and would trip the auto-promote
 * rule marginally more often — not what you want on a switch that reallocates traffic.
 */
export function evaluateTest(params: {
  control: ArmCounts;
  variant: ArmCounts;
  /** Planning baseline for sample sizing; defaults to the control's observed rate. */
  baselineCr?: number;
  mde?: number;
}): TestResult {
  const { control, variant } = params;

  const controlCr = conversionRate(control);
  const variantCr = conversionRate(variant);

  const baselineForPlanning = params.baselineCr ?? (controlCr > 0 ? controlCr : DEFAULT_BASELINE_CR);
  const sampleTarget = requiredSampleSize(baselineForPlanning, params.mde);

  const minVisitors = Math.min(control.visitors, variant.visitors);
  const isUnderpowered = minVisitors < sampleTarget;

  let zScore: number | null = null;
  let pValue: number | null = null;

  if (control.visitors > 0 && variant.visitors > 0) {
    const pooled =
      (control.conversions + variant.conversions) / (control.visitors + variant.visitors);
    const standardError = Math.sqrt(
      pooled * (1 - pooled) * (1 / control.visitors + 1 / variant.visitors)
    );

    // SE is zero when neither arm has converted at all — no signal, not significance.
    if (standardError > 0) {
      zScore = (variantCr - controlCr) / standardError;
      pValue = twoTailedPValue(zScore);
    }
  }

  return {
    control,
    variant,
    control_cr: controlCr,
    variant_cr: variantCr,
    relative_lift_pct: controlCr > 0 ? ((variantCr - controlCr) / controlCr) * 100 : null,
    absolute_lift_pp: (variantCr - controlCr) * 100,
    z_score: zScore,
    p_value: pValue,
    confidence_pct: pValue === null ? null : (1 - pValue) * 100,
    is_significant: zScore !== null && Math.abs(zScore) >= Z_CRITICAL_95,
    sample_target: sampleTarget,
    is_underpowered: isUnderpowered,
    remaining_visitors: Math.max(0, sampleTarget - minVisitors),
  };
}

/** Format a proportion as a percentage string, e.g. 0.0482 -> "4.82%". */
export function formatPct(value: number | null, digits = 2): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`;
}

/** Format an already-percentage number with an explicit sign, e.g. -12.4 -> "-12.4%". */
export function formatSignedPct(value: number | null, digits = 1): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
