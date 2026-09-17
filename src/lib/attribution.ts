import type { AstroCookies } from 'astro';

/**
 * Marketing attribution capture.
 *
 * Captured on the server from the landing request and persisted **first-touch** in a
 * cookie, because a signup should be credited to the channel that acquired the visitor.
 * A visitor who arrives from a Meta ad, leaves, and returns via direct would otherwise
 * credit "direct" and make paid campaigns look worthless. Last-touch is also useful —
 * in production both would be stored and the model chosen at analysis time.
 */

export const ATTRIBUTION_COOKIE = 'fxr_attr';
/** 90 days — a conventional attribution window for a considered B2C signup. */
export const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export type Channel =
  | 'paid_search'
  | 'paid_social'
  | 'organic_search'
  | 'social_organic'
  | 'email'
  | 'affiliate'
  | 'referral'
  | 'direct';

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Ad-platform click ids, useful for reconciling against platform-reported conversions. */
  click_id: string | null;
  referrer: string | null;
  /** Derived bucket, so analysis does not have to re-parse UTM combinations. */
  channel: Channel;
  /** Path the visitor first landed on. */
  landing_path: string | null;
}

const PAID_SEARCH_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'sem']);
const PAID_SOCIAL_MEDIUMS = new Set(['paid_social', 'paidsocial', 'social_paid', 'cpm', 'display']);
const SOCIAL_SOURCES = new Set([
  'facebook',
  'fb',
  'instagram',
  'ig',
  'meta',
  'tiktok',
  'twitter',
  'x',
  'youtube',
  'linkedin',
  'reddit',
]);
const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'brave.'];

function clean(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 255);
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

/**
 * Collapse UTM parameters and referrer into a single channel bucket.
 * Order matters: explicit UTM signals always beat referrer inference.
 */
export function deriveChannel(params: {
  utm_source: string | null;
  utm_medium: string | null;
  click_id: string | null;
  referrer: string | null;
}): Channel {
  const { utm_source, utm_medium, click_id, referrer } = params;

  if (utm_medium) {
    if (PAID_SEARCH_MEDIUMS.has(utm_medium)) {
      return utm_source && SOCIAL_SOURCES.has(utm_source) ? 'paid_social' : 'paid_search';
    }
    if (PAID_SOCIAL_MEDIUMS.has(utm_medium)) return 'paid_social';
    if (utm_medium === 'email' || utm_medium === 'newsletter') return 'email';
    if (utm_medium === 'affiliate' || utm_medium === 'partner') return 'affiliate';
    if (utm_medium === 'organic') {
      return utm_source && SOCIAL_SOURCES.has(utm_source) ? 'social_organic' : 'organic_search';
    }
    if (utm_medium === 'social') return 'social_organic';
    if (utm_medium === 'referral') return 'referral';
  }

  // A bare click id means paid traffic whose UTMs were dropped somewhere upstream.
  if (click_id) return 'paid_search';

  if (utm_source) {
    return SOCIAL_SOURCES.has(utm_source) ? 'social_organic' : 'referral';
  }

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      if (SEARCH_HOSTS.some((search) => host.includes(search))) return 'organic_search';
      if ([...SOCIAL_SOURCES].some((social) => host.includes(social))) return 'social_organic';
      return 'referral';
    } catch {
      return 'referral';
    }
  }

  return 'direct';
}

/** Parse attribution out of a landing request. */
export function parseAttribution(url: URL, referrer: string | null): Attribution {
  const get = (key: string) => clean(url.searchParams.get(key));

  const utm_source = get('utm_source');
  const utm_medium = get('utm_medium');
  const click_id = get('gclid') ?? get('fbclid') ?? get('ttclid') ?? get('msclkid');

  // Ignore same-origin referrers: an internal navigation is not an acquisition source.
  let externalReferrer: string | null = null;
  if (referrer) {
    try {
      externalReferrer =
        new URL(referrer).hostname !== url.hostname ? referrer.slice(0, 500) : null;
    } catch {
      externalReferrer = null;
    }
  }

  return {
    utm_source,
    utm_medium,
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    click_id,
    referrer: externalReferrer,
    channel: deriveChannel({ utm_source, utm_medium, click_id, referrer: externalReferrer }),
    landing_path: url.pathname,
  };
}

/**
 * Return the visitor's first-touch attribution, capturing it on first landing.
 *
 * Once set, the cookie is not overwritten — that is what makes it first-touch. A later
 * visit carrying fresh UTMs does not clobber the original acquisition source.
 */
export function getOrCreateAttribution(
  cookies: AstroCookies,
  url: URL,
  referrer: string | null
): Attribution {
  const existing = cookies.get(ATTRIBUTION_COOKIE);
  if (existing) {
    try {
      return existing.json() as Attribution;
    } catch {
      // Corrupt cookie — fall through and re-capture.
    }
  }

  const attribution = parseAttribution(url, referrer);

  cookies.set(ATTRIBUTION_COOKIE, attribution, {
    path: '/',
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // read by the analytics client so events carry the same attribution
    secure: import.meta.env.PROD,
  });

  return attribution;
}
