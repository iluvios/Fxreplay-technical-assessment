import type { APIRoute } from 'astro';
import { experimentDb, invalidateRegistryCache } from '../../../lib/experiment-repo';
import { isSignedIn } from '../../../lib/admin-auth';
import { json, redirectTo } from '../../../lib/admin-api';

export const prerender = false;

/**
 * Human-in-the-loop resolution for an escalated experiment.
 *
 * These are the links the agent puts in its HUMAN_REVIEW alert. They are GETs so they
 * work as plain links inside Slack or an email, which means they must be treated as
 * untrusted: anything that can be linked can be clicked by accident, prefetched by a
 * client, or forwarded. So the endpoint requires an admin session rather than a token
 * in the URL — clicking the link takes you through login first, and the action runs
 * from a page you are actually looking at.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §4, row 3.
 */

type EngineAction = 'kill' | 'promote' | 'extend';

const CONFIRMATIONS: Record<EngineAction, (name: string) => string> = {
  kill: (name) => `"${name}" deactivated — its traffic now reverts to control.`,
  promote: (name) => `"${name}" promoted to 100% of traffic.`,
  extend: (name) => `"${name}" left running. The agent will re-evaluate on its next pass.`,
};

export const GET: APIRoute = async ({ url, cookies }) => {
  const action = url.searchParams.get('action') as EngineAction | null;
  const experimentId = url.searchParams.get('experiment_id');
  const variantId = url.searchParams.get('variant_id');

  if (!isSignedIn(cookies)) {
    const next = encodeURIComponent(url.pathname + url.search);
    return redirectTo(`/marketingengine/login?next=${next}`);
  }

  if (!action || !experimentId || !(action in CONFIRMATIONS)) {
    return json({ success: false, error: 'Missing or unknown action' }, 400);
  }

  const experiment = await experimentDb.get(experimentId);
  if (!experiment) return json({ success: false, error: 'Experiment not found' }, 404);

  const variant = experiment.variants.find((candidate) => candidate.id === variantId);
  if (action !== 'extend' && !variant) {
    return json({ success: false, error: 'Variant not found' }, 404);
  }

  const name = variant?.variant_name ?? experiment.name;
  const returnTo = `/marketingengine/experiments/${experimentId}`;

  if (action === 'kill') {
    await experimentDb.deactivateVariant(variant!.id);
    invalidateRegistryCache();
  } else if (action === 'promote') {
    await experimentDb.promoteVariant(experimentId, variant!.id);
    invalidateRegistryCache();
  }

  // Recorded even for `extend`, which changes nothing: "a human looked at this and
  // chose to wait" is exactly the fact that is missing when a test drifts for a week.
  await experimentDb.recordDecision({
    experiment_id: experimentId,
    variant_id: variant?.id ?? null,
    decision: action === 'kill' ? 'KILL' : action === 'promote' ? 'PROMOTE' : 'CONTINUE',
    trigger_source: 'human',
    metrics_source: 'database',
    control_visitors: 0,
    control_signups: 0,
    variant_visitors: 0,
    variant_signups: 0,
    control_cr: null,
    variant_cr: null,
    relative_lift_pct: null,
    z_score: null,
    p_value: null,
    confidence_pct: null,
    sample_target: null,
    is_significant: false,
    is_underpowered: false,
    rationale: `Resolved manually from an agent escalation: ${action}.`,
    ai_diagnosis: null,
    ai_model: null,
    action_taken: CONFIRMATIONS[action](name),
    executed: action !== 'extend',
  });

  return redirectTo(`${returnTo}?ok=${encodeURIComponent(CONFIRMATIONS[action](name))}`);
};
