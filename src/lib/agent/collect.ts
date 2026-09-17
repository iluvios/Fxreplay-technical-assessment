import {
  experimentDb,
  type ExperimentWithVariants,
  type VariantRecord,
} from '../experiment-repo';
import { COPY_DICTIONARY } from '../copy-dictionary';
import {
  fetchVariantTelemetry,
  isPostHogConfigured,
  type VariantTelemetry,
} from '../posthog-query';

/**
 * Stage 1 of the evaluation pipeline: telemetry ingestion.
 *
 * Two sources, and the difference between them matters more than it looks:
 *
 *   PostHog  — unique visitors exposed per arm (the denominator) and unique converters.
 *   Neon     — verified account rows, which are the ground truth for the numerator.
 *
 * A conversion rate needs both. The database alone knows how many people signed up but
 * not how many saw the page, so it cannot produce a rate at all. That is why a run
 * without PostHog is labelled `database` and treated as advisory: the downstream
 * decision engine refuses to take irreversible action on it.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §3 Stage 1.
 */

export interface ArmMetrics {
  variant: VariantRecord;
  /** Unique visitors exposed. Zero when exposure was never measured. */
  visitors: number;
  /** Conversions on the primary metric. */
  signups: number;
  cta_clicks: number | null;
  signup_starts: number | null;
  /** Verified account rows attributed to this arm, independent of client telemetry. */
  db_signups: number;
  /** The headline copy this arm serves, for the AI layer to reason about. */
  headline: string | null;
}

export interface ExperimentMetrics {
  experiment: ExperimentWithVariants;
  /** Which source produced the visitor counts. Gates what the agent is allowed to do. */
  source: 'posthog' | 'database';
  control: ArmMetrics | null;
  /** Non-control arms, in the order they are stored. */
  treatments: ArmMetrics[];
  /** Trailing window the telemetry covers, in days. */
  window_days: number;
  /** Anything the operator should know about how these numbers were obtained. */
  notes: string[];
}

/**
 * Events carry `copy.variant_id` (e.g. "prop_firm_hunter"), while the database keys
 * arms by `variant_key` (e.g. "1"). This is the bridge between the two namespaces.
 */
function telemetryIdFor(variant: VariantRecord): string {
  return COPY_DICTIONARY[variant.variant_key]?.variant_id ?? variant.variant_key;
}

function headlineFor(variant: VariantRecord): string | null {
  const copy = COPY_DICTIONARY[variant.variant_key];
  if (copy) return copy.hero.headline;

  // Fall back to the stored snapshot for arms whose copy is no longer in the build.
  const payload = variant.copy_payload as { headline?: string } | null;
  return payload?.headline ?? null;
}

function buildArm(
  variant: VariantRecord,
  telemetry: VariantTelemetry | undefined,
  dbSignups: number
): ArmMetrics {
  return {
    variant,
    visitors: telemetry?.impressions ?? 0,
    // The server-side event and the database row describe the same act. Where they
    // disagree, the database wins: it is the record that a user actually exists.
    signups: Math.max(telemetry?.signups ?? 0, dbSignups),
    cta_clicks: telemetry?.cta_clicks ?? null,
    signup_starts: telemetry?.signup_starts ?? null,
    db_signups: dbSignups,
    headline: headlineFor(variant),
  };
}

/**
 * Gather one experiment's arm-level metrics.
 *
 * Never throws on a telemetry failure. A PostHog outage degrades the run to a
 * database-only, advisory evaluation rather than skipping the experiment entirely —
 * an agent that goes silent when one dependency wobbles is worse than one that
 * reports what it still knows.
 */
export async function collectMetrics(params: {
  experiment: ExperimentWithVariants;
  windowDays?: number;
}): Promise<ExperimentMetrics> {
  const { experiment, windowDays = 30 } = params;
  const notes: string[] = [];

  const dbCounts = await experimentDb.signupCountsByVariant(experiment.id);
  const dbByVariantId = new Map(dbCounts.map((row) => [row.variant_id, row.signups]));

  let telemetry: VariantTelemetry[] = [];
  let source: ExperimentMetrics['source'] = 'database';

  if (!isPostHogConfigured()) {
    notes.push(
      'PostHog credentials are not configured, so exposure counts are unavailable. ' +
        'Conversion rates cannot be computed and no automated action will be taken.'
    );
  } else {
    try {
      telemetry = await fetchVariantTelemetry({ experimentId: experiment.id, windowDays });
      if (telemetry.length === 0) {
        notes.push(
          `PostHog returned no events for experiment "${experiment.id}" in the last ${windowDays} days.`
        );
      } else {
        source = 'posthog';
      }
    } catch (error) {
      notes.push(
        `PostHog query failed (${error instanceof Error ? error.message : 'unknown error'}). ` +
          'Falling back to database counts; no automated action will be taken.'
      );
    }
  }

  const telemetryById = new Map(telemetry.map((row) => [row.variant_id, row]));

  const arms = experiment.variants.map((variant) =>
    buildArm(
      variant,
      telemetryById.get(telemetryIdFor(variant)),
      dbByVariantId.get(variant.id) ?? 0
    )
  );

  // Two ways the exposure data can be present but unusable, both of which would
  // otherwise produce a confident 0.00% conversion rate next to a non-zero signup
  // count — a number that looks like a measurement and is not one.
  //
  //   1. No exposures at all: the query succeeded but the events never landed, e.g.
  //      the tracking snippet is blocked or the experiment has had no traffic.
  //   2. More conversions than exposures: impossible when both are counted over unique
  //      visitors, so the exposure side is incomplete.
  //
  // Either way the denominator is not real, and the agent must not act on it.
  if (source === 'posthog') {
    const totalImpressions = arms.reduce((sum, arm) => sum + arm.visitors, 0);
    const inverted = arms.some((arm) => arm.signups > arm.visitors);

    if (totalImpressions === 0) {
      source = 'database';
      notes.push(
        'PostHog recorded no exposures for this experiment, so there is no denominator ' +
          'for a conversion rate. Reporting signup counts only; no automated action.'
      );
    } else if (inverted) {
      source = 'database';
      notes.push(
        'Conversions exceed measured exposures on at least one arm, so exposure tracking ' +
          'is incomplete. Reporting signup counts only; no automated action.'
      );
    }
  }

  return {
    experiment,
    source,
    control: arms.find((arm) => arm.variant.is_control) ?? null,
    treatments: arms.filter((arm) => !arm.variant.is_control),
    window_days: windowDays,
    notes,
  };
}
