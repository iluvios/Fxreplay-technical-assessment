import type { APIRoute } from 'astro';
import { runEvaluation, type MetricsFixture } from '../../../lib/agent';
import { isSignedIn } from '../../../lib/admin-auth';
import { parseRequest, json, redirectTo } from '../../../lib/admin-api';

export const prerender = false;

/**
 * Trigger the evaluation agent.
 *
 *   POST /api/engine/evaluate   manual run (admin session, or Bearer CRON_SECRET)
 *   GET  /api/engine/evaluate   Vercel Cron, which only issues GETs
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §2 — dual execution modes.
 */

function cronSecret(): string | undefined {
  return process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
}

/**
 * A signed-in admin, or a bearer token matching CRON_SECRET.
 *
 * When no secret is configured the token path is closed rather than left open — an
 * unset environment variable must never widen access to an endpoint that can pause
 * live traffic.
 */
function authorize(request: Request, cookies: Parameters<APIRoute>[0]['cookies']): boolean {
  if (isSignedIn(cookies)) return true;

  const secret = cronSecret();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

/** Fixtures are accepted only alongside dryRun, so synthetic numbers can never act. */
function readFixture(fields: Record<string, string>, dryRun: boolean): MetricsFixture | undefined {
  if (!dryRun || !fields.fixture) return undefined;

  try {
    const parsed = JSON.parse(fields.fixture) as MetricsFixture;
    if (
      Number.isFinite(parsed?.control?.visitors) &&
      Number.isFinite(parsed?.control?.signups) &&
      Number.isFinite(parsed?.variant?.visitors) &&
      Number.isFinite(parsed?.variant?.signups)
    ) {
      return parsed;
    }
  } catch {
    // Malformed fixture is ignored; the run proceeds against real data.
  }
  return undefined;
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!authorize(request, cookies)) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  const parsed = await parseRequest(request);
  const dryRun = parsed.fields.dry_run === 'true' || url.searchParams.get('dry_run') === 'true';
  const experimentId = parsed.fields.experiment_id || url.searchParams.get('experiment_id');

  try {
    const run = await runEvaluation({
      trigger: 'manual',
      experimentId,
      dryRun,
      windowDays: Number(parsed.fields.window_days) || undefined,
      fixture: readFixture(parsed.fields, dryRun),
    });

    if (parsed.isForm) {
      const summary =
        run.evaluated === 0
          ? 'No running experiments to evaluate.'
          : run.results
              .map((result) => `${result.experiment_id}: ${result.decision}`)
              .join(' · ');
      const target = experimentId
        ? `/marketingengine/experiments/${experimentId}`
        : '/marketingengine/agent';
      return redirectTo(`${target}?ok=${encodeURIComponent(`Evaluation complete — ${summary}`)}`);
    }

    return json({ success: true, data: run }, 200);
  } catch (error) {
    console.error('[api/engine/evaluate] run failed:', error);
    return parsed.isForm
      ? redirectTo(`/marketingengine/agent?err=${encodeURIComponent('Evaluation failed')}`)
      : json({ success: false, error: 'Evaluation failed' }, 500);
  }
};

/** GET — the Vercel Cron entry point. Same work, no body. */
export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!authorize(request, cookies)) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const run = await runEvaluation({
      // A GET from Vercel Cron carries the bearer token; an admin hitting it in a
      // browser is doing the same thing by hand, so both record as scheduled runs
      // unless an experiment was named explicitly.
      trigger: isSignedIn(cookies) ? 'manual' : 'cron',
      experimentId: url.searchParams.get('experiment_id'),
      dryRun: url.searchParams.get('dry_run') === 'true',
    });
    return json({ success: true, data: run }, 200);
  } catch (error) {
    console.error('[api/engine/evaluate] scheduled run failed:', error);
    return json({ success: false, error: 'Evaluation failed' }, 500);
  }
};
