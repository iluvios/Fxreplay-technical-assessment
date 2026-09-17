import { COPY_DICTIONARY, type ExperimentVariantCopy } from './copy-dictionary';

/**
 * Experiment assignment engine.
 *
 * One variable drives the landing experience:
 *
 *   ?lp=N   Runs landing-page experiment N. The visitor is bucketed into one of the
 *           experiment's arms by a deterministic hash, so every arm draws from the
 *           same traffic population and a difference in conversion is attributable
 *           to the copy rather than to traffic quality.
 *
 *   (none)  Control copy, no experiment participation.
 *
 * An experiment can test anything; here the arms are ICP-framed messaging, because
 * matching a real user need is a stronger lever than visual polish.
 *
 * Assignment resolves on the server before HTML is serialised, so variant copy is
 * present on first paint (no client-side swap, CLS 0.00).
 */

export interface ExperimentArm {
  /** Key into COPY_DICTIONARY. */
  variant_key: string;
  /** Relative traffic allocation. Weights are normalised, so they need not sum to 100. */
  weight: number;
  is_control: boolean;
}

export interface Experiment {
  /** Value carried in ?lp= — human-readable rather than a UUID. */
  id: string;
  /** Stable slug used as the experiment key in PostHog. */
  name: string;
  hypothesis: string;
  status: 'running' | 'paused' | 'completed';
  /** Primary conversion event. */
  primary_metric: string;
  /** ICP this experiment targets, matching `icps.id` in the database. */
  icp_id: string;
  arms: ExperimentArm[];
}

export interface Assignment {
  experiment_id: string;
  experiment_name: string;
  variant_key: string;
  variant_id: string;
  is_control: boolean;
  /**
   * True when the arm was forced via ?variant= for QA rather than randomly assigned.
   * Preview traffic must be excluded from analysis, so no exposure event is emitted.
   */
  is_preview: boolean;
}

/**
 * Experiment registry — the static fallback used when the database is unreachable.
 * The live source is the `experiments` table (see src/lib/experiment-repo.ts).
 *
 * One experiment per ICP, each testing three competing messages against the same
 * generic control. Every arm asks the same question: does speaking to this audience
 * specifically beat the message they would otherwise have seen?
 *
 * Three treatment arms per experiment is a deliberate cost. It finds a winner in one
 * cycle instead of three sequential tests, which matters when each cycle needs ~1,240
 * visitors per arm — but testing three hypotheses at once inflates the chance that one
 * looks significant by luck. `src/lib/agent/decide.ts` applies a Šidák correction to
 * the promote gate to pay for that.
 */
export const EXPERIMENTS: Record<string, Experiment> = {
  '1': {
    id: '1',
    name: 'prop_firm_message_angle',
    icp_id: 'icp_prop_hunter',
    hypothesis:
      'For prop-firm evaluation traders, a hero that names a specific cost they have ' +
      'already paid — failed evaluation fees, the daily drawdown rule, or the absence of ' +
      'a track record — converts better than the generic risk-free-backtesting baseline, ' +
      'because this audience has a quantified, recurring and recent monetary loss.',
    status: 'running',
    primary_metric: 'signup_completed',
    arms: [
      { variant_key: 'control', weight: 25, is_control: true },
      { variant_key: 'prop_fees', weight: 25, is_control: false },
      { variant_key: 'prop_rules', weight: 25, is_control: false },
      { variant_key: 'prop_funded', weight: 25, is_control: false },
    ],
  },

  '2': {
    id: '2',
    name: 'weekend_warrior_message_angle',
    icp_id: 'icp_weekend_warrior',
    hypothesis:
      'For time-poor professionals, a hero built on the scarcity of practice time — ' +
      'compressed market hours, accumulated repetitions, or learning without risking ' +
      'salary — converts better than the generic baseline, because their blocker is ' +
      'available hours rather than money or motivation.',
    status: 'running',
    primary_metric: 'signup_completed',
    arms: [
      { variant_key: 'control', weight: 25, is_control: true },
      { variant_key: 'weekend_year', weight: 25, is_control: false },
      { variant_key: 'weekend_reps', weight: 25, is_control: false },
      { variant_key: 'weekend_career', weight: 25, is_control: false },
    ],
  },

  '3': {
    id: '3',
    name: 'precision_message_angle',
    icp_id: 'icp_tv_skeptic',
    hypothesis:
      'For technical traders already paying for a charting tool, a hero making a ' +
      'falsifiable claim about measurement fidelity — no lookahead bias, tick-level ' +
      'fills, or journalled expectancy — converts better than the generic baseline, ' +
      'because this audience distrusts marketing language and responds to specifics ' +
      'they can verify themselves.',
    status: 'running',
    primary_metric: 'signup_completed',
    arms: [
      { variant_key: 'control', weight: 25, is_control: true },
      { variant_key: 'tv_bias', weight: 25, is_control: false },
      { variant_key: 'tv_precision', weight: 25, is_control: false },
      { variant_key: 'tv_journal', weight: 25, is_control: false },
    ],
  },
};

/** Cookie holding the anonymous visitor id used for sticky bucketing. */
export const VISITOR_COOKIE = 'fxr_vid';
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Cookie recording which experiment the visitor is enrolled in.
 *
 * Without it, /api/users depends on the caller passing ?lp=, and a conversion would be
 * silently dropped from the experiment if that param were ever omitted. The arm itself is
 * still re-derived from the visitor hash, so this only carries enrolment, not the result.
 */
export const EXPERIMENT_COOKIE = 'fxr_exp';
export const EXPERIMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const BUCKET_RESOLUTION = 10_000;

/**
 * FNV-1a, 32-bit. Chosen over `Math.random()` because bucketing must be a pure function
 * of (visitor, experiment): the same visitor must land in the same arm on every request,
 * or their funnel splits across arms and conversion attribution becomes meaningless.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable bucket in [0, BUCKET_RESOLUTION) for a visitor within one experiment. */
export function bucketFor(visitorId: string, experimentId: string): number {
  return fnv1a(`${visitorId}:${experimentId}`) % BUCKET_RESOLUTION;
}

/** Deterministically pick an arm from the experiment's weighted allocation. */
export function assignArm(experiment: Experiment, visitorId: string): ExperimentArm {
  const totalWeight = experiment.arms.reduce((sum, arm) => sum + arm.weight, 0);
  const bucket = bucketFor(visitorId, experiment.id);
  const threshold = (bucket / BUCKET_RESOLUTION) * totalWeight;

  let cumulative = 0;
  for (const arm of experiment.arms) {
    cumulative += arm.weight;
    if (threshold < cumulative) return arm;
  }
  // Only reachable through floating-point edge cases at the very top of the range.
  return experiment.arms[experiment.arms.length - 1];
}

/** A running experiment by id, or null when unknown / not running. */
export function getExperiment(experimentId: string | null | undefined): Experiment | null {
  if (!experimentId) return null;
  const experiment = EXPERIMENTS[experimentId];
  return experiment && experiment.status === 'running' ? experiment : null;
}

function copyFor(variantKey: string): ExperimentVariantCopy {
  return COPY_DICTIONARY[variantKey] ?? COPY_DICTIONARY.control;
}

/**
 * Resolve the copy and experiment assignment for a request.
 *
 * `previewVariant` forces a specific arm for QA/screenshots. It is flagged as preview so
 * it never emits an exposure event or pollutes experiment results.
 */
export function resolveExperience(params: {
  lp: string | null | undefined;
  previewVariant?: string | null;
  visitorId: string;
}): { copy: ExperimentVariantCopy; assignment: Assignment | null } {
  const { lp, previewVariant, visitorId } = params;

  const experiment = getExperiment(lp);
  if (!experiment) {
    return { copy: COPY_DICTIONARY.control, assignment: null };
  }

  const forced =
    previewVariant && experiment.arms.find((arm) => arm.variant_key === previewVariant);
  const arm = forced || assignArm(experiment, visitorId);
  const copy = copyFor(arm.variant_key);

  return {
    copy,
    assignment: {
      experiment_id: experiment.id,
      experiment_name: experiment.name,
      variant_key: arm.variant_key,
      variant_id: copy.variant_id,
      is_control: arm.is_control,
      is_preview: Boolean(forced),
    },
  };
}
