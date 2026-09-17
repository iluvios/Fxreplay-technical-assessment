import { evaluateTest, type TestResult } from '../stats';
import type { ArmMetrics, ExperimentMetrics } from './collect';

/**
 * Stages 2 and 4: the statistical gate and the decision matrix.
 *
 * Deliberately free of any model call. Two of the four outcomes change what live
 * traffic sees, and a decision that can pause a campaign has to be reproducible from
 * its inputs — a reviewer must be able to read the counts, read the thresholds, and
 * arrive at the same verdict. The AI layer writes the explanation; it never chooses.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §3 Stage 2 and §4.
 */

export type Decision = 'PROMOTE' | 'KILL' | 'HUMAN_REVIEW' | 'CONTINUE';

/** Thresholds, gathered so they can be read — and argued with — in one place. */
export const RULES = {
  /** Relative lift required before a winner is promoted automatically. */
  PROMOTE_MIN_LIFT_PCT: 15,
  /** Two-tailed significance required to promote. */
  PROMOTE_MAX_P: 0.05,
  /** Relative loss that trips the circuit breaker. */
  KILL_MAX_LIFT_PCT: -25,
  /** Visitors per arm before the circuit breaker is allowed to fire at all. */
  KILL_MIN_VISITORS: 500,
  /**
   * Significance required to kill. Looser than the promote gate on purpose: the costs
   * are asymmetric. Pausing a variant that was merely mediocre wastes a little learning;
   * letting a genuinely -25% variant keep taking paid traffic wastes budget every hour.
   * A false kill is recoverable in one click, a false promote reshapes the whole funnel.
   */
  KILL_MAX_P: 0.1,
  /** p-values in this band are "nearly there" and go to a human rather than a rule. */
  REVIEW_P_BAND: [0.05, 0.15] as const,
} as const;

/**
 * Šidák-corrected significance threshold for `k` simultaneous comparisons.
 *
 *   α_adjusted = 1 - (1 - α)^(1/k)
 *
 * Each experiment runs three treatment arms against one control, which is three chances
 * for an arm to clear p < 0.05 by luck alone — about a 14% probability that at least one
 * does when none of them actually works. Promoting on an uncorrected p-value would mean
 * roughly one in seven "winners" is noise, permanently replacing the control.
 *
 * At k = 3 this tightens the promote gate from 0.05 to ≈0.017.
 *
 * Applied to the promote gate only, deliberately. Correcting the kill gate too would
 * make the circuit breaker slower, and the asymmetry runs the other way there: a false
 * kill costs a little learning and reverses in one click, while a variant genuinely
 * losing 25% keeps spending budget every hour it stays live.
 */
export function sidakThreshold(alpha: number, comparisons: number): number {
  if (comparisons <= 1) return alpha;
  return 1 - Math.pow(1 - alpha, 1 / comparisons);
}

export interface ArmVerdict {
  arm: ArmMetrics;
  test: TestResult;
  decision: Decision;
  /** Deterministic explanation of which rule fired and on what numbers. */
  rationale: string;
}

export interface ExperimentVerdict {
  metrics: ExperimentMetrics;
  /** The arm the run is about — the strongest signal among the treatments. */
  primary: ArmVerdict | null;
  /** Every treatment arm scored, for the detail view. */
  arms: ArmVerdict[];
  /** True when the run may execute promote/kill. False forces HUMAN_REVIEW or CONTINUE. */
  actionable: boolean;
  /** Set when the whole experiment could not be scored. */
  blocked_reason: string | null;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function signed(value: number | null): string {
  if (value === null) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function describe(arm: ArmMetrics, test: TestResult): string {
  return (
    `control ${test.control.conversions}/${test.control.visitors} (${pct(test.control_cr)}) ` +
    `vs "${arm.variant.variant_name}" ${test.variant.conversions}/${test.variant.visitors} ` +
    `(${pct(test.variant_cr)}), lift ${signed(test.relative_lift_pct)}, ` +
    `p=${test.p_value === null ? 'n/a' : test.p_value.toFixed(4)}`
  );
}

/**
 * Score one treatment arm against control.
 *
 * `actionable` gates the two destructive outcomes. It is false when exposure was never
 * measured — without a denominator every conversion rate is fiction, and acting on
 * fiction is the failure mode this whole service exists to prevent.
 */
function judgeArm(params: {
  control: ArmMetrics;
  arm: ArmMetrics;
  baselineCr: number | null;
  actionable: boolean;
  /** Number of treatment arms in this experiment, for the multiple-comparison correction. */
  comparisons: number;
}): ArmVerdict {
  const { control, arm, baselineCr, actionable, comparisons } = params;
  const promoteMaxP = sidakThreshold(RULES.PROMOTE_MAX_P, comparisons);

  const test = evaluateTest({
    control: { visitors: control.visitors, conversions: control.signups },
    variant: { visitors: arm.visitors, conversions: arm.signups },
    // The experiment's recorded baseline drives sample-size planning when present, so
    // the target does not drift with whatever the control happens to be doing today.
    baselineCr: baselineCr !== null ? baselineCr / 100 : undefined,
  });

  const summary = describe(arm, test);

  if (!actionable) {
    return {
      arm,
      test,
      decision: 'HUMAN_REVIEW',
      rationale:
        `No measured exposure data, so conversion rates cannot be verified. ` +
        `Reporting database counts only: control ${control.signups} signups, ` +
        `"${arm.variant.variant_name}" ${arm.signups} signups. Automated action withheld.`,
    };
  }

  const lift = test.relative_lift_pct;
  const p = test.p_value;

  // ── Circuit breaker ────────────────────────────────────────────────────────
  // Checked before the winner rule so a collapsing variant is stopped even in the
  // (impossible, but cheap to guarantee) case that both rules could match.
  if (
    lift !== null &&
    lift <= RULES.KILL_MAX_LIFT_PCT &&
    Math.min(control.visitors, arm.visitors) >= RULES.KILL_MIN_VISITORS &&
    p !== null &&
    p < RULES.KILL_MAX_P
  ) {
    return {
      arm,
      test,
      decision: 'KILL',
      rationale:
        `Circuit breaker: ${summary}. Loss of ${signed(lift)} exceeds the ` +
        `${RULES.KILL_MAX_LIFT_PCT}% threshold at n≥${RULES.KILL_MIN_VISITORS} per arm ` +
        `with p<${RULES.KILL_MAX_P}. Deactivating the arm stops further paid traffic ` +
        `reaching it; those visitors revert to control.`,
    };
  }

  // ── Winner ─────────────────────────────────────────────────────────────────
  if (
    !test.is_underpowered &&
    p !== null &&
    p < promoteMaxP &&
    lift !== null &&
    lift >= RULES.PROMOTE_MIN_LIFT_PCT
  ) {
    return {
      arm,
      test,
      decision: 'PROMOTE',
      rationale:
        `Winner: ${summary}. Both arms exceed the ${test.sample_target} visitor ` +
        `sample target, the lift clears the ${RULES.PROMOTE_MIN_LIFT_PCT}% promotion bar, ` +
        `and p is below ${promoteMaxP.toFixed(4)}` +
        (comparisons > 1
          ? ` — the 0.05 threshold Šidák-corrected for ${comparisons} competing arms.`
          : ' (95% confidence).'),
    };
  }

  // ── Would have won a two-arm test ──────────────────────────────────────────
  // Clears the lift bar and the ordinary 0.05 threshold, but not the corrected one.
  // Auto-promoting would spend the multiple-comparison budget the correction exists to
  // protect; silently continuing would bury a result someone should look at. So it goes
  // to a human, who can extend the run or drop the weaker arms and let it resolve.
  if (
    !test.is_underpowered &&
    p !== null &&
    p < RULES.PROMOTE_MAX_P &&
    lift !== null &&
    lift >= RULES.PROMOTE_MIN_LIFT_PCT
  ) {
    return {
      arm,
      test,
      decision: 'HUMAN_REVIEW',
      rationale:
        `Promising but not yet decisive across ${comparisons} arms: ${summary}. ` +
        `This clears the ${RULES.PROMOTE_MIN_LIFT_PCT}% lift bar and ordinary 95% ` +
        `significance, but not the ${promoteMaxP.toFixed(4)} threshold required when ` +
        `${comparisons} arms compete for the same win. Extend the run, or retire the ` +
        `weaker arms and let this one resolve against control alone.`,
    };
  }

  // ── Underpowered ───────────────────────────────────────────────────────────
  if (test.is_underpowered) {
    const nearlySignificant =
      p !== null && p >= RULES.REVIEW_P_BAND[0] && p <= RULES.REVIEW_P_BAND[1];

    // An underpowered test that is already knocking on the door is worth a human's
    // attention — extending it 48h is a decision with a deadline. One that is nowhere
    // near is just young, and pinging anyone about it is how alerts get muted.
    return {
      arm,
      test,
      decision: nearlySignificant ? 'HUMAN_REVIEW' : 'CONTINUE',
      rationale:
        `Underpowered: ${summary}. Needs ${test.sample_target} visitors per arm, ` +
        `${test.remaining_visitors} still to go on the slower arm.` +
        (nearlySignificant
          ? ` Already at ${test.confidence_pct?.toFixed(1)}% confidence — close enough that ` +
            `extending the run is a judgement call.`
          : ' Keeping the test running.'),
    };
  }

  // ── Powered but not decisive ───────────────────────────────────────────────
  if (p !== null && p >= RULES.REVIEW_P_BAND[0] && p <= RULES.REVIEW_P_BAND[1]) {
    return {
      arm,
      test,
      decision: 'HUMAN_REVIEW',
      rationale:
        `Inconclusive: ${summary}. Sample target reached but the result sits in the ` +
        `p=${RULES.REVIEW_P_BAND[0]}–${RULES.REVIEW_P_BAND[1]} band — neither a win nor a ` +
        `clean null. Needs a call on whether to extend or iterate the copy.`,
    };
  }

  if (test.is_significant && lift !== null && lift < RULES.PROMOTE_MIN_LIFT_PCT && lift > 0) {
    return {
      arm,
      test,
      decision: 'HUMAN_REVIEW',
      rationale:
        `Significant but small: ${summary}. The effect is real but below the ` +
        `${RULES.PROMOTE_MIN_LIFT_PCT}% bar for an automatic promotion. Worth a human ` +
        `deciding whether the gain justifies retiring the control.`,
    };
  }

  return {
    arm,
    test,
    decision: 'CONTINUE',
    rationale:
      `No decisive signal: ${summary}. Sample target met but the difference is not ` +
      `distinguishable from noise. Leaving the test running.`,
  };
}

/** Ranking used to pick the arm a run reports on. Destructive findings surface first. */
const PRIORITY: Record<Decision, number> = {
  KILL: 0,
  PROMOTE: 1,
  HUMAN_REVIEW: 2,
  CONTINUE: 3,
};

/**
 * Score every treatment arm and pick the one the run is about.
 *
 * Every arm is scored, but only the highest-priority one drives an action — a single run
 * never promotes two arms or promotes one while killing another.
 *
 * The p-values are corrected for the number of competing arms (see `sidakThreshold`),
 * so a three-arm experiment is held to a stricter bar than a two-arm one rather than
 * getting three free chances at the same threshold.
 */
export function judgeExperiment(metrics: ExperimentMetrics): ExperimentVerdict {
  const { control, treatments } = metrics;

  if (!control) {
    return {
      metrics,
      primary: null,
      arms: [],
      actionable: false,
      blocked_reason: 'Experiment has no control arm, so there is nothing to compare against.',
    };
  }

  // Only arms currently taking traffic are scored. A deactivated arm — retired by hand,
  // or killed by an earlier run — cannot accumulate new data, so re-judging it would at
  // best repeat a decision already taken and at worst let a stale arm win an experiment
  // it is no longer part of. It also must not inflate the multiple-comparison count,
  // which should reflect how many messages are genuinely competing right now.
  const liveTreatments = treatments.filter((arm) => arm.variant.active);

  if (liveTreatments.length === 0) {
    return {
      metrics,
      primary: null,
      arms: [],
      actionable: false,
      blocked_reason:
        treatments.length === 0
          ? 'Experiment has no treatment arms.'
          : 'Every treatment arm is deactivated, so all traffic is already served the control.',
    };
  }

  const actionable = metrics.source === 'posthog';

  const arms = liveTreatments.map((arm) =>
    judgeArm({
      control,
      arm,
      baselineCr: metrics.experiment.baseline_cr,
      actionable,
      comparisons: liveTreatments.length,
    })
  );

  const primary = [...arms].sort(
    (a, b) =>
      PRIORITY[a.decision] - PRIORITY[b.decision] ||
      // Within the same decision, the larger absolute effect is the more interesting one.
      Math.abs(b.test.relative_lift_pct ?? 0) - Math.abs(a.test.relative_lift_pct ?? 0)
  )[0];

  return { metrics, primary, arms, actionable, blocked_reason: null };
}
