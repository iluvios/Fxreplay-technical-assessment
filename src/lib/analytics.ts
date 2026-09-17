import type { PostHog } from 'posthog-js';

// Event Taxonomy Definition
// Required by Section 4: Event Taxonomy & Conversion Funnel
export type GrowthEventName =
  | 'landing_page_viewed'
  | 'cta_button_clicked'
  | 'signup_page_viewed'
  | 'signup_form_started'
  | 'signup_form_submitted'
  /**
   * Emitted client-side for funnel completeness only. The canonical conversion is the
   * server-side `signup_completed` from /api/users, which ad blockers cannot suppress.
   */
  | 'signup_completed'
  | 'signup_error_encountered'
  | 'experiment_variant_exposed'
  | 'backtest_preview_interacted';

export interface GrowthEventProperties {
  cta_location?:
    | 'hero'
    /** Secondary hero path — anchors to the simulator rather than to signup. */
    | 'hero_secondary'
    | 'nav'
    | 'feature_section'
    | 'feature_tabs'
    | 'asset_coverage'
    | 'footer'
    | 'sticky_bottom';
  cta_copy?: string;
  experiment_id?: string;
  experiment_name?: string;
  variant_id?: string;
  /** True when the visitor was bucketed into the experiment's control arm. */
  is_control?: boolean;
  /** Anonymous id used for sticky experiment bucketing; joins client events to the server-assigned arm. */
  visitor_id?: string;
  /** Selected "primary trading goal" — the ICP segment the user self-identifies with. */
  icp_focus?: string;
  /** First-touch marketing attribution, so funnels can be split by acquisition source. */
  channel?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  error_message?: string;
  error_code?: number | string;
  error_field?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

/** Defer to the first idle moment after paint, so the SDK never competes with CSS/fonts. */
function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 3000 });
  } else {
    window.setTimeout(task, 1200);
  }
}

class AnalyticsManager {
  /** Set once a PUBLIC_POSTHOG_KEY is present — i.e. events have somewhere to go. */
  private configured = false;
  /** The SDK, once its lazy chunk has landed. */
  private client: PostHog | null = null;
  /** Calls made before the SDK arrived. Replayed in order, so nothing is dropped. */
  private pending: Array<(client: PostHog) => void> = [];
  private loading = false;

  init() {
    if (typeof window === 'undefined' || this.loading) return;

    const apiKey = import.meta.env.PUBLIC_POSTHOG_KEY;

    if (!apiKey) {
      console.info('[Analytics] PostHog API key not configured. Running in developer audit mode.');
      return;
    }

    this.configured = true;
    this.loading = true;

    // posthog-js is ~100 KB over the wire. A static import put it on the critical
    // path, where it stole mobile bandwidth from the render-blocking CSS and fonts.
    // Loading it on idle instead keeps first paint clean; events queue until it lands.
    whenIdle(() => {
      void import('posthog-js').then(({ default: posthog }) => {
        posthog.init(apiKey, {
          api_host: import.meta.env.PUBLIC_POSTHOG_HOST || '/ingest',
          ui_host: 'https://us.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false, // Handled explicitly to ensure accurate SPA/astro pageviews
          autocapture: false, // Explicit taxonomy over messy autocapture
          cross_subdomain_cookie: true,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: '[data-attr="ph-no-capture"]',
          },
        });

        this.client = posthog;
        const queued = this.pending;
        this.pending = [];
        queued.forEach((call) => call(posthog));
      });
    });
  }

  /** Run now if the SDK is ready, otherwise hold the call until it is. */
  private send(call: (client: PostHog) => void) {
    if (this.client) call(this.client);
    else this.pending.push(call);
  }

  track(eventName: GrowthEventName, properties: GrowthEventProperties = {}) {
    if (typeof window === 'undefined') return;

    const enrichedProperties = {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || '$direct',
      screen_width: window.innerWidth,
    };

    if (this.configured) {
      // Timestamp is stamped here, not on flush, so queued events keep their real order.
      this.send((client) => client.capture(eventName, enrichedProperties));
    } else {
      // In local testing/evaluation mode, log nicely formatted event to console for code reviewers
      console.log(`%c[Tracked Event: ${eventName}]`, 'color: #53B483; font-weight: bold;', enrichedProperties);
    }
  }

  identify(userId: string, traits: Record<string, unknown>) {
    if (typeof window === 'undefined') return;

    if (this.configured) {
      this.send((client) => client.identify(userId, traits));
    } else {
      console.log(`%c[Identity Aliased: ${userId}]`, 'color: #0260FD; font-weight: bold;', traits);
    }
  }

  /** Falls back until the SDK is loaded — variants are resolved server-side, never here. */
  getVariant(experimentName: string, fallback = 'control'): string {
    if (typeof window === 'undefined' || !this.client) return fallback;
    const flag = this.client.getFeatureFlag(experimentName);
    return typeof flag === 'string' ? flag : fallback;
  }
}

export const analytics = new AnalyticsManager();
