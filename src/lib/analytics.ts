import posthog from 'posthog-js';

// Event Taxonomy Definition
// Required by Section 4: Event Taxonomy & Conversion Funnel
export type GrowthEventName =
  | 'landing_page_viewed'
  | 'cta_button_clicked'
  | 'signup_modal_opened'
  | 'signup_form_started'
  | 'signup_form_submitted'
  | 'signup_completed'
  | 'signup_error_encountered'
  | 'experiment_variant_exposed'
  | 'backtest_preview_interacted';

export interface GrowthEventProperties {
  cta_location?: 'hero' | 'nav' | 'feature_section' | 'sticky_bottom';
  cta_copy?: string;
  experiment_id?: string;
  variant_id?: string;
  experience_level?: string;
  primary_market?: string;
  error_message?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

class AnalyticsManager {
  private initialized = false;

  init() {
    if (typeof window === 'undefined' || this.initialized) return;

    const apiKey = import.meta.env.PUBLIC_POSTHOG_KEY;
    const apiHost = import.meta.env.PUBLIC_POSTHOG_HOST || '/ingest';

    if (apiKey) {
      posthog.init(apiKey, {
        api_host: apiHost,
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
      this.initialized = true;
    } else {
      console.info('[Analytics] PostHog API key not configured. Running in developer audit mode.');
    }
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

    if (this.initialized) {
      posthog.capture(eventName, enrichedProperties);
    } else {
      // In local testing/evaluation mode, log nicely formatted event to console for code reviewers
      console.log(`%c[Tracked Event: ${eventName}]`, 'color: #00D26A; font-weight: bold;', enrichedProperties);
    }
  }

  identify(userId: string, traits: Record<string, unknown>) {
    if (typeof window === 'undefined') return;

    if (this.initialized) {
      posthog.identify(userId, traits);
    } else {
      console.log(`%c[Identity Aliased: ${userId}]`, 'color: #2563EB; font-weight: bold;', traits);
    }
  }

  getVariant(experimentName: string, fallback = 'control'): string {
    if (typeof window === 'undefined' || !this.initialized) return fallback;
    const flag = posthog.getFeatureFlag(experimentName);
    return typeof flag === 'string' ? flag : fallback;
  }
}

export const analytics = new AnalyticsManager();
