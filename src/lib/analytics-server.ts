/**
 * Server-side PostHog capture.
 *
 * The canonical conversion event is emitted here rather than from the browser. Client
 * events are best-effort: ad blockers suppress a meaningful share of them, and that loss
 * is not random — it skews technical audiences, which would bias an experiment arm
 * measuring exactly that segment. A server event cannot be blocked, so the experiment's
 * primary metric stays trustworthy.
 *
 * Client events remain valuable for behavioural depth (scroll, dwell, CTA clicks); they
 * are simply not what the decision rests on.
 */

/** Absolute host — the client may route through /ingest, but the server calls PostHog directly. */
function resolveHost(): string {
  const configured = process.env.PUBLIC_POSTHOG_HOST ?? import.meta.env.PUBLIC_POSTHOG_HOST;
  if (!configured || configured.startsWith('/')) return 'https://us.i.posthog.com';
  return configured.replace(/\/$/, '');
}

function resolveKey(): string | undefined {
  return process.env.PUBLIC_POSTHOG_KEY ?? import.meta.env.PUBLIC_POSTHOG_KEY;
}

export interface ServerEvent {
  event: string;
  /** Must match the client's distinct id so server and client events join to one person. */
  distinctId: string;
  properties?: Record<string, unknown>;
}

/**
 * Send one event to PostHog.
 *
 * Never throws: a telemetry failure must not turn a successful signup into an error
 * response. Bounded by a short timeout so a slow PostHog cannot hold the request open.
 */
export async function captureServerEvent({
  event,
  distinctId,
  properties = {},
}: ServerEvent): Promise<void> {
  const apiKey = resolveKey();

  if (!apiKey) {
    console.info(`[analytics:server] PostHog key not configured — skipped "${event}"`);
    return;
  }

  try {
    const response = await fetch(`${resolveHost()}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Marks the event as server-emitted so client/server duplicates can be told
          // apart during reconciliation.
          $lib: 'fxr-server',
        },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      console.error(`[analytics:server] "${event}" rejected with ${response.status}`);
    }
  } catch (error) {
    console.error(
      `[analytics:server] "${event}" failed:`,
      error instanceof Error ? error.message : error
    );
  }
}
