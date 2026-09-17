import {
  experimentDb,
  invalidateRegistryCache,
  type ExperimentWithVariants,
  type DecisionRecord,
} from '../experiment-repo';
import { collectMetrics, type ExperimentMetrics } from './collect';
import { judgeExperiment, type ExperimentVerdict, type Decision } from './decide';
import { diagnose, type Diagnosis } from './diagnose';
import { dispatchAlert, alertEventFor, alertIconFor } from './notify';

/**
 * The autonomous experiment evaluation agent.
 *
 * Four stages, in order, per docs/AUTONOMOUS_EXPERIMENT_SERVICE.md:
 *
 *   1. Ingest   — PostHog exposure/conversion counts joined with verified account rows.
 *   2. Gate     — deterministic sample-size check and two-tailed Z-test (lib/stats.ts).
 *   3. Diagnose — a model explains the result against the ICP. Never decides anything.
 *   4. Act      — promote, kill, escalate to a human, or leave it running.
 *
 * The ordering is the point. By the time a model is called the decision is already
 * fixed, so a hallucinated sentence can embarrass the report but cannot reallocate
 * traffic. Every run is written to `experiment_decisions` whether or not it acted.
 */

export interface ExperimentRunResult {
  experiment_id: string;
  experiment_name: string;
  decision: Decision;
  executed: boolean;
  action_taken: string;
  rationale: string;
  diagnosis: Diagnosis;
  alerted: boolean;
  metrics: ExperimentMetrics;
  verdict: ExperimentVerdict;
  /** Null on a dry run, where nothing is persisted. */
  record: DecisionRecord | null;
}

export interface EvaluationRun {
  started_at: string;
  finished_at: string;
  trigger: 'cron' | 'manual' | 'human';
  dry_run: boolean;
  evaluated: number;
  results: ExperimentRunResult[];
  /** Experiments that were skipped, and why. */
  skipped: Array<{ experiment_id: string; reason: string }>;
}

/** Synthetic counts, accepted only on a dry run. See `runEvaluation`. */
export interface MetricsFixture {
  control: { visitors: number; signups: number };
  variant: { visitors: number; signups: number };
}

function publicBaseUrl(): string {
  const configured =
    process.env.PUBLIC_SITE_URL ??
    import.meta.env.PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return (configured ?? 'http://localhost:4321').replace(/\/$/, '');
}

/**
 * Stage 4 execution.
 *
 * Only PROMOTE and KILL touch anything. Both are reversible from the admin console in
 * one click, which is what makes automating them defensible at all — the agent is
 * allowed to be wrong, it is not allowed to be wrong irrecoverably.
 */
async function executeDecision(
  verdict: ExperimentVerdict,
  dryRun: boolean
): Promise<{ executed: boolean; action: string }> {
  const { primary } = verdict;
  if (!primary) {
    return { executed: false, action: verdict.blocked_reason ?? 'Nothing to act on.' };
  }

  const armName = primary.arm.variant.variant_name;
  const experimentId = verdict.metrics.experiment.id;

  if (primary.decision === 'PROMOTE') {
    const action =
      `"${armName}" promoted to 100% of traffic; all other arms deactivated and the ` +
      `experiment closed as winner_promoted.`;
    if (dryRun) return { executed: false, action: `[dry run] ${action}` };

    await experimentDb.promoteVariant(experimentId, primary.arm.variant.id);
    invalidateRegistryCache();
    return { executed: true, action };
  }

  if (primary.decision === 'KILL') {
    const action =
      `"${armName}" deactivated. Its share of traffic now resolves to control on the ` +
      `next request, stopping further spend against the losing copy.`;
    if (dryRun) return { executed: false, action: `[dry run] ${action}` };

    await experimentDb.deactivateVariant(primary.arm.variant.id);
    invalidateRegistryCache();
    return { executed: true, action };
  }

  if (primary.decision === 'HUMAN_REVIEW') {
    return {
      executed: false,
      action: 'Left running and escalated to a growth engineer for a decision.',
    };
  }

  return { executed: false, action: 'Left running; no threshold was crossed.' };
}

/** Round for storage — the schema's numeric precisions are tighter than a float64. */
function round(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function alertFor(
  verdict: ExperimentVerdict,
  diagnosis: Diagnosis,
  action: string
): Promise<boolean> {
  const { primary, metrics } = verdict;
  if (!primary) return false;

  const event = alertEventFor(primary.decision);
  if (!event) return false;

  const { test } = primary;
  const base = publicBaseUrl();

  return dispatchAlert({
    event,
    title: `${alertIconFor(primary.decision)} ${metrics.experiment.name}: ${primary.decision.replace('_', ' ')}`,
    experiment_id: metrics.experiment.id,
    experiment_name: metrics.experiment.name,
    decision: primary.decision,
    metrics: {
      arm: primary.arm.variant.variant_name,
      control_cr: `${(test.control_cr * 100).toFixed(2)}%`,
      variant_cr: `${(test.variant_cr * 100).toFixed(2)}%`,
      lift: test.relative_lift_pct === null ? 'n/a' : `${test.relative_lift_pct.toFixed(1)}%`,
      p_value: test.p_value === null ? 'n/a' : test.p_value.toFixed(4),
      sample: `${test.control.visitors} control / ${test.variant.visitors} variant (target ${test.sample_target})`,
      source: metrics.source,
    },
    ai_diagnosis: diagnosis.narrative,
    action_taken: action,
    // Only the escalation path needs buttons; a promote or kill has already happened.
    recommended_actions:
      primary.decision === 'HUMAN_REVIEW'
        ? [
            {
              label: 'Inspect experiment',
              action_url: `${base}/marketingengine/experiments/${metrics.experiment.id}`,
            },
            {
              label: `Kill "${primary.arm.variant.variant_name}"`,
              action_url:
                `${base}/api/engine/action?action=kill` +
                `&experiment_id=${encodeURIComponent(metrics.experiment.id)}` +
                `&variant_id=${encodeURIComponent(primary.arm.variant.id)}`,
            },
          ]
        : undefined,
  });
}

/** Run the full pipeline against one experiment. */
export async function evaluateExperiment(params: {
  experiment: ExperimentWithVariants;
  trigger: EvaluationRun['trigger'];
  dryRun: boolean;
  windowDays?: number;
  fixture?: MetricsFixture;
}): Promise<ExperimentRunResult> {
  const { experiment, trigger, dryRun, windowDays, fixture } = params;

  const metrics = await collectMetrics({ experiment, windowDays });

  // A fixture replaces the measured counts so the decision matrix can be exercised
  // end-to-end without waiting for real traffic. Guarded to dry runs by the caller,
  // and marked as measured only so the gating logic runs — nothing is ever written.
  // Applied to the first arm actually taking traffic — a retired arm is excluded from
  // scoring, so loading a fixture into one would produce a run with nothing to decide.
  const fixtureTarget = metrics.treatments.find((arm) => arm.variant.active);

  if (fixture && metrics.control && fixtureTarget) {
    metrics.control.visitors = fixture.control.visitors;
    metrics.control.signups = fixture.control.signups;
    fixtureTarget.visitors = fixture.variant.visitors;
    fixtureTarget.signups = fixture.variant.signups;
    metrics.source = 'posthog';
    metrics.notes.push(
      `SYNTHETIC FIXTURE — counts were supplied, not measured (applied to "${fixtureTarget.variant.variant_name}").`
    );
  }

  const verdict = judgeExperiment(metrics);
  const diagnosis = await diagnose(verdict);
  const { executed, action } = await executeDecision(verdict, dryRun);

  const decision: Decision = verdict.primary?.decision ?? 'CONTINUE';
  const rationale = verdict.primary?.rationale ?? verdict.blocked_reason ?? 'Nothing to evaluate.';

  let record: DecisionRecord | null = null;
  let alerted = false;

  if (!dryRun) {
    const test = verdict.primary?.test ?? null;

    record = await experimentDb.recordDecision({
      experiment_id: experiment.id,
      variant_id: verdict.primary?.arm.variant.id ?? null,
      decision,
      trigger_source: trigger,
      metrics_source: metrics.source,
      control_visitors: test?.control.visitors ?? 0,
      control_signups: test?.control.conversions ?? 0,
      variant_visitors: test?.variant.visitors ?? 0,
      variant_signups: test?.variant.conversions ?? 0,
      control_cr: round(test ? test.control_cr * 100 : null, 3),
      variant_cr: round(test ? test.variant_cr * 100 : null, 3),
      relative_lift_pct: round(test?.relative_lift_pct ?? null, 2),
      z_score: round(test?.z_score ?? null, 4),
      p_value: round(test?.p_value ?? null, 5),
      confidence_pct: round(test?.confidence_pct ?? null, 3),
      sample_target: test?.sample_target ?? null,
      is_significant: test?.is_significant ?? false,
      is_underpowered: test?.is_underpowered ?? true,
      rationale,
      ai_diagnosis: diagnosis.narrative,
      ai_model: diagnosis.model,
      action_taken: action,
      executed,
    });

    await experimentDb.markEvaluated(experiment.id);
    alerted = await alertFor(verdict, diagnosis, action);
  }

  return {
    experiment_id: experiment.id,
    experiment_name: experiment.name,
    decision,
    executed,
    action_taken: action,
    rationale,
    diagnosis,
    alerted,
    metrics,
    verdict,
    record,
  };
}

/**
 * Evaluate every running experiment, or one named experiment.
 *
 * Experiments are processed sequentially rather than in parallel: each one issues a
 * PostHog query and a model call, and a burst of those from a serverless function is
 * the shape that trips rate limits. Two runs a day have no reason to be fast.
 */
export async function runEvaluation(params: {
  trigger: EvaluationRun['trigger'];
  experimentId?: string | null;
  dryRun?: boolean;
  windowDays?: number;
  /** Only honoured together with `dryRun`. */
  fixture?: MetricsFixture;
}): Promise<EvaluationRun> {
  const { trigger, experimentId, dryRun = false, windowDays, fixture } = params;
  const startedAt = new Date().toISOString();

  const all = await experimentDb.list();
  const candidates = experimentId
    ? all.filter((experiment) => experiment.id === experimentId)
    : all.filter((experiment) => experiment.status === 'running');

  const results: ExperimentRunResult[] = [];
  const skipped: EvaluationRun['skipped'] = [];

  for (const experiment of candidates) {
    // A named experiment that is not running is still evaluated on request — a human
    // asking about a paused test wants the numbers, not a refusal — but a paused test
    // is never acted on, because there is no live traffic to protect or promote.
    const isLive = experiment.status === 'running';

    try {
      results.push(
        await evaluateExperiment({
          experiment,
          trigger,
          dryRun: dryRun || !isLive,
          windowDays,
          fixture,
        })
      );
    } catch (error) {
      skipped.push({
        experiment_id: experiment.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`[agent] evaluation failed for "${experiment.id}":`, error);
    }
  }

  if (experimentId && candidates.length === 0) {
    skipped.push({ experiment_id: experimentId, reason: 'Experiment not found' });
  }

  return {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    trigger,
    dry_run: dryRun,
    evaluated: results.length,
    results,
    skipped,
  };
}
