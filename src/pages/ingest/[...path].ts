import type { APIRoute } from 'astro';

/**
 * First-party reverse proxy for PostHog.
 *
 * Ad blockers match on third-party hostnames, so `us.i.posthog.com` requests are widely
 * blocked. Serving the same traffic from our own origin under /ingest makes it a
 * first-party request. This matters beyond raw volume: blocked traffic skews technical,
 * which is precisely the TradingView-skeptic segment, so losing it would bias experiment
 * arms rather than just shrinking them uniformly.
 *
 * PostHog splits its endpoints across two origins — static assets on us-assets, ingestion
 * and decide on us — so the path prefix decides the upstream.
 */

export const prerender = false;

const ASSET_HOST = 'https://us-assets.i.posthog.com';
const INGEST_HOST = 'https://us.i.posthog.com';

/** Hop-by-hop and origin-specific headers that must not be forwarded upstream. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host', // set by fetch from the target URL
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length', // recomputed by fetch; forwarding a stale value fails the request
  'accept-encoding', // let fetch negotiate, since we hand back a decoded body
  'cookie', // PostHog identifies via the payload; our cookies are not its business
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-encoding', // fetch already decoded the body
  'content-length',
]);

export const ALL: APIRoute = async ({ params, request }) => {
  const path = params.path ?? '';
  const upstreamHost = path.startsWith('static/') ? ASSET_HOST : INGEST_HOST;

  const incoming = new URL(request.url);
  const target = new URL(`${upstreamHost}/${path}`);
  target.search = incoming.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // Buffer rather than stream: event payloads are small, and a buffered body lets fetch
  // set Content-Length itself. Streaming needs duplex:'half' and fails outright whenever
  // the forwarded length disagrees with the re-sent body.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // Telemetry must never break the page: fail quietly with a non-retried status.
    console.error('[ingest] proxy failed:', error instanceof Error ? error.message : error);
    return new Response(null, { status: 204 });
  }
};
