/**
 * Read-side PostHog client.
 *
 * `analytics-server.ts` writes events; this reads them back aggregated. Queries go
 * through the HogQL endpoint rather than the Insights/Funnel API because a funnel
 * definition is a saved object that has to be kept in sync with the code — one SQL
 * string that lives next to the event taxonomy it queries cannot drift from it.
 *
 * Requires POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID. Without them the client
 * reports itself unconfigured and the agent falls back to database-only counts.
 */

export interface VariantTelemetry {
  /** Matches `copy.variant_id` — the value both client and server events carry. */
  variant_id: string;
  /** Unique visitors that saw this arm. The denominator for conversion rate. */
  impressions: number;
  cta_clicks: number;
  signup_starts: number;
  /** Unique visitors that completed signup, from the server-emitted event. */
  signups: number;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

/**
 * The capture host and the API host differ: events go to `us.i.posthog.com`, queries to
 * `us.posthog.com`. Deriving one from the other avoids a second variable that is only
 * ever set to the obvious value.
 */
function apiHost(): string {
  const explicit = env('POSTHOG_API_HOST');
  if (explicit) return explicit.replace(/\/$/, '');

  const capture = env('PUBLIC_POSTHOG_HOST');
  if (capture && !capture.startsWith('/')) {
    return capture.replace(/\/$/, '').replace('://us.i.', '://us.').replace('://eu.i.', '://eu.');
  }
  return 'https://us.posthog.com';
}

export function isPostHogConfigured(): boolean {
  return Boolean(env('POSTHOG_PERSONAL_API_KEY') && env('POSTHOG_PROJECT_ID'));
}

/** Raised when PostHog is configured but the query could not be completed. */
export class PostHogQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostHogQueryError';
  }
}

async function runHogQL(query: string): Promise<unknown[][]> {
  const key = env('POSTHOG_PERSONAL_API_KEY');
  const projectId = env('POSTHOG_PROJECT_ID');

  if (!key || !projectId) throw new PostHogQueryError('PostHog API credentials not configured');

  const response = await fetch(`${apiHost()}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    // The agent runs on a cron with no user waiting, but a hung query would still hold
    // a serverless invocation open to its timeout and cost the run.
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new PostHogQueryError(
      `PostHog query failed with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
    );
  }

  const body = (await response.json()) as { results?: unknown[][] };
  return body.results ?? [];
}

/** SQL string literal escaping — experiment ids are validated on write, but never trust twice. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Per-arm funnel counts for one experiment over a trailing window.
 *
 * Counted on unique `visitor_id` rather than raw events throughout: the conversion rate
 * that matters is per person, and one visitor reloading the landing page five times
 * would otherwise deflate the rate of whichever arm they happened to land in.
 *
 * `signup_completed` is restricted to the server-emitted copy ($lib = 'fxr-server').
 * The client emits the same event name for funnel completeness, and counting both would
 * double-count every conversion that was not ad-blocked — which is exactly the
 * population that differs between arms.
 */
export async function fetchVariantTelemetry(params: {
  experimentId: string;
  windowDays?: number;
}): Promise<VariantTelemetry[]> {
  const { experimentId, windowDays = 30 } = params;

  const rows = await runHogQL(`
    SELECT
      properties.variant_id AS variant_id,
      uniqIf(properties.visitor_id, event = 'experiment_variant_exposed') AS impressions,
      uniqIf(properties.visitor_id, event = 'cta_button_clicked')         AS cta_clicks,
      uniqIf(properties.visitor_id, event = 'signup_form_started')        AS signup_starts,
      uniqIf(properties.visitor_id,
             event = 'signup_completed' AND properties."$lib" = 'fxr-server') AS signups
    FROM events
    WHERE properties.experiment_id = ${quote(experimentId)}
      AND timestamp >= now() - INTERVAL ${Math.max(1, Math.floor(windowDays))} DAY
    GROUP BY variant_id
    HAVING variant_id != ''
  `);

  return rows.map((row) => ({
    variant_id: String(row[0]),
    impressions: Number(row[1]) || 0,
    cta_clicks: Number(row[2]) || 0,
    signup_starts: Number(row[3]) || 0,
    signups: Number(row[4]) || 0,
  }));
}
