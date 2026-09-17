import type { AstroCookies } from 'astro';
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  EXPERIMENT_COOKIE,
  EXPERIMENT_COOKIE_MAX_AGE,
  type Assignment,
} from './experiments';

/**
 * Anonymous visitor identity used for sticky experiment bucketing.
 *
 * Kept separate from `experiments.ts` so the bucketing logic stays a pure function with
 * no framework coupling.
 *
 * The cookie is first-party and readable by client JS on purpose: PostHog needs the same
 * id to join client-side events to the server-assigned arm. It carries no personal data —
 * just a random identifier.
 */
export function getOrCreateVisitorId(cookies: AstroCookies): string {
  const existing = cookies.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const visitorId = crypto.randomUUID();

  cookies.set(VISITOR_COOKIE, visitorId, {
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // must be readable by the analytics client to join events to the arm
    secure: import.meta.env.PROD,
  });

  return visitorId;
}

/**
 * Record which experiment the visitor is enrolled in, so a later conversion can be
 * attributed even if the signup request omits ?lp=.
 *
 * Preview traffic is never recorded — QA must not enter experiment results.
 */
export function rememberEnrolment(cookies: AstroCookies, assignment: Assignment | null): void {
  if (!assignment || assignment.is_preview) return;
  if (cookies.get(EXPERIMENT_COOKIE)?.value === assignment.experiment_id) return;

  cookies.set(EXPERIMENT_COOKIE, assignment.experiment_id, {
    path: '/',
    maxAge: EXPERIMENT_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
    secure: import.meta.env.PROD,
  });
}
