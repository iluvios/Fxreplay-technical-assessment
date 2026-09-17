import { experimentDb, type IcpRecord } from '../experiment-repo';
import type { ArmVerdict, ExperimentVerdict } from './decide';

/**
 * Stage 3: the qualitative layer.
 *
 * The model's job is narrow on purpose. It receives the decision that has already been
 * made and the numbers that produced it, and it explains *why* the result looks the way
 * it does in terms of the ICP's psychology. It is not asked whether the variant won,
 * because it cannot compute that reliably and the answer is already known.
 *
 * Everything here is best-effort. A model outage, a rate limit or a malformed response
 * degrades to a deterministic narrative assembled from the same facts — the run still
 * completes and still acts, it is just less articulate about it.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §3 Stage 3.
 */

export interface Diagnosis {
  /** Prose explanation for the report. Never empty. */
  narrative: string;
  /** Concrete next step for the growth engineer, when the model offers one. */
  recommendation: string | null;
  /** Model that produced it, or null when this is the deterministic fallback. */
  model: string | null;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

/** Cost-optimised by default — this runs twice a day and never blocks a user. */
const DEFAULT_MODEL = 'gpt-5.6-luna';
const API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are the FX Replay Growth Intelligence Agent.

You analyse A/B test results for a market-replay and backtesting product sold to retail
traders. The statistics have ALREADY been computed deterministically and the decision has
ALREADY been made by a rules engine. Do not recompute, contradict, or second-guess them.

Your job is to explain WHY the numbers look the way they do, grounded in the stated ICP's
pains and desires and in the actual wording of the headlines being tested.

Rules:
- Never invent metrics. Use only the numbers given to you.
- If the sample is underpowered, say so plainly rather than over-reading the trend.
- Be specific about the copy: name the psychological mechanism the headline is using.
- Write for a growth engineer, not a marketer. No hype, no exclamation marks.

Respond with JSON only, matching exactly:
{"narrative": "2-4 sentences explaining the result", "recommendation": "one concrete next step, or null"}`;

function formatIcp(icp: IcpRecord | null): string {
  if (!icp) return 'No ICP is attached to this experiment.';

  return [
    `- Name: ${icp.name}`,
    `- Core emotion: ${icp.primary_emotion}`,
    `- Acquisition channel: ${icp.target_channel}`,
    `- Core pains: ${icp.core_pains.join('; ') || 'not recorded'}`,
    `- Core desires: ${icp.core_desires.join('; ') || 'not recorded'}`,
  ].join('\n');
}

function formatArm(verdict: ArmVerdict): string {
  const { test, arm } = verdict;
  return [
    `  name: ${arm.variant.variant_name}`,
    `  headline: ${arm.headline ?? '(no copy on record)'}`,
    `  visitors: ${test.variant.visitors} | signups: ${test.variant.conversions} | CR: ${(test.variant_cr * 100).toFixed(2)}%`,
  ].join('\n');
}

function buildUserPrompt(verdict: ExperimentVerdict, icp: IcpRecord | null): string {
  const { metrics, primary } = verdict;
  if (!primary) return '';

  const { test } = primary;
  const control = metrics.control!;

  return `[EXPERIMENT]
- Name: ${metrics.experiment.name}
- Hypothesis: ${metrics.experiment.hypothesis}
- Primary metric: ${metrics.experiment.primary_metric}
- Telemetry window: last ${metrics.window_days} days
- Data source: ${metrics.source === 'posthog' ? 'PostHog exposure data (measured)' : 'database signup counts only (no exposure denominator)'}

[ICP CONTEXT]
${formatIcp(icp)}

[CONTROL]
  name: ${control.variant.variant_name}
  headline: ${control.headline ?? '(no copy on record)'}
  visitors: ${test.control.visitors} | signups: ${test.control.conversions} | CR: ${(test.control_cr * 100).toFixed(2)}%

[TREATMENT]
${formatArm(primary)}

[STATISTICS — computed deterministically, treat as fact]
- Relative lift: ${test.relative_lift_pct === null ? 'n/a' : `${test.relative_lift_pct.toFixed(1)}%`}
- Z-score: ${test.z_score === null ? 'n/a' : test.z_score.toFixed(3)}
- p-value: ${test.p_value === null ? 'n/a' : test.p_value.toFixed(4)}
- Confidence: ${test.confidence_pct === null ? 'n/a' : `${test.confidence_pct.toFixed(1)}%`}
- Sample target per arm: ${test.sample_target} (${test.is_underpowered ? `underpowered, ${test.remaining_visitors} visitors short` : 'reached'})

[DECISION ALREADY TAKEN BY THE RULES ENGINE]
- ${primary.decision}
- Reason: ${primary.rationale}
${metrics.notes.length > 0 ? `\n[CAVEATS]\n${metrics.notes.map((note) => `- ${note}`).join('\n')}` : ''}

Explain why this result occurred and what to do next.`;
}

/**
 * Deterministic narrative used when no model is reachable.
 *
 * Restates the mechanism from data already in hand rather than apologising for the
 * missing model — a report that says "AI unavailable" and nothing else is useless to
 * whoever opens the alert at 08:00.
 */
function fallbackDiagnosis(verdict: ExperimentVerdict, icp: IcpRecord | null): Diagnosis {
  const { primary, metrics } = verdict;

  if (!primary) {
    return {
      narrative:
        verdict.blocked_reason ?? 'The experiment could not be scored and was left untouched.',
      recommendation: null,
      model: null,
    };
  }

  const { test, arm } = primary;
  const icpLine = icp
    ? `The arm targets ${icp.name}, whose dominant motivation is ${icp.primary_emotion.toLowerCase()}.`
    : 'No ICP is attached to this experiment, so the result cannot be read against a persona.';

  const trend =
    test.relative_lift_pct === null
      ? 'There is no control conversion rate to compare against.'
      : test.relative_lift_pct > 0
        ? `"${arm.variant.variant_name}" is running ${test.relative_lift_pct.toFixed(1)}% above control.`
        : `"${arm.variant.variant_name}" is running ${Math.abs(test.relative_lift_pct).toFixed(1)}% below control.`;

  const strength = test.is_underpowered
    ? `The sample is still ${test.remaining_visitors} visitors short of the ${test.sample_target} needed per arm, so the direction is suggestive rather than established.`
    : test.is_significant
      ? `The difference is statistically significant (p=${test.p_value?.toFixed(4)}).`
      : `The difference is not distinguishable from noise (p=${test.p_value?.toFixed(4)}).`;

  return {
    narrative: `${trend} ${strength} ${icpLine}`,
    recommendation:
      metrics.source === 'posthog'
        ? null
        : 'Configure POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID so exposure counts are available and the agent can act autonomously.',
    model: null,
  };
}

/**
 * Ask the model to explain the result.
 *
 * Bounded by a timeout and wrapped so that no failure mode — network, rate limit,
 * unparseable JSON, an unsupported parameter on a newer model — can take down a run
 * whose real work (the statistics and the decision) is already complete.
 */
export async function diagnose(verdict: ExperimentVerdict): Promise<Diagnosis> {
  const icps = await experimentDb.listIcps().catch(() => [] as IcpRecord[]);
  const icp = icps.find((candidate) => candidate.id === verdict.metrics.experiment.icp_id) ?? null;

  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey || !verdict.primary) {
    if (!apiKey) {
      console.info('[agent:diagnose] OPENAI_API_KEY not set — using deterministic narrative.');
    }
    return fallbackDiagnosis(verdict, icp);
  }

  const model = env('OPENAI_MODEL') ?? DEFAULT_MODEL;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // `max_completion_tokens` rather than the legacy `max_tokens`: newer models
        // reject the old name outright.
        max_completion_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(verdict, icp) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[agent:diagnose] ${model} returned ${response.status}: ${detail.slice(0, 300)}`);
      return fallbackDiagnosis(verdict, icp);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbackDiagnosis(verdict, icp);

    const parsed = JSON.parse(content) as { narrative?: unknown; recommendation?: unknown };
    const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';

    // An empty or non-string narrative is a malformed response, not a valid one.
    if (!narrative) return fallbackDiagnosis(verdict, icp);

    return {
      narrative,
      recommendation:
        typeof parsed.recommendation === 'string' && parsed.recommendation.trim()
          ? parsed.recommendation.trim()
          : null,
      model,
    };
  } catch (error) {
    console.error(
      '[agent:diagnose] diagnosis failed, using deterministic narrative:',
      error instanceof Error ? error.message : error
    );
    return fallbackDiagnosis(verdict, icp);
  }
}
