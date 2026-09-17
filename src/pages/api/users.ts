import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { userDb, DuplicateEmailError } from '../../lib/db';
import { CreateUserSchema, type SignupContext } from '../../lib/schemas';
import { ATTRIBUTION_COOKIE, type Attribution } from '../../lib/attribution';
import { VISITOR_COOKIE, EXPERIMENT_COOKIE } from '../../lib/experiments';
import { resolveLiveExperience } from '../../lib/experiment-repo';
import { COPY_DICTIONARY } from '../../lib/copy-dictionary';
import { captureServerEvent } from '../../lib/analytics-server';

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Build the signup context from server-side state.
 *
 * Attribution and experiment assignment come from cookies, never the request body, so a
 * caller cannot claim a different acquisition channel or a different experiment arm.
 * The arm is re-derived from the same (visitorId, experiment) hash used to render the
 * landing page, so it is guaranteed to match what the visitor actually saw.
 */
async function buildSignupContext(
  cookies: Parameters<APIRoute>[0]['cookies'],
  lp: string | null
): Promise<SignupContext> {
  const visitorId = cookies.get(VISITOR_COOKIE)?.value ?? null;

  let attribution: Partial<Attribution> = {};
  try {
    attribution = (cookies.get(ATTRIBUTION_COOKIE)?.json() as Attribution) ?? {};
  } catch {
    // Corrupt or absent attribution cookie is not fatal to a signup.
  }

  // Fall back to the enrolment cookie set at landing, so a conversion is still attributed
  // if the request omits ?lp=. The arm is re-derived from the visitor hash either way.
  const experimentId = lp ?? cookies.get(EXPERIMENT_COOKIE)?.value ?? null;
  const assignment = visitorId
    ? (await resolveLiveExperience({ lp: experimentId, visitorId })).assignment
    : null;

  return {
    visitor_id: visitorId,
    // Preview traffic is excluded so QA signups never land in experiment results.
    experiment_id: assignment && !assignment.is_preview ? assignment.experiment_id : null,
    variant_key: assignment && !assignment.is_preview ? assignment.variant_key : null,
    utm_source: attribution.utm_source ?? null,
    utm_medium: attribution.utm_medium ?? null,
    utm_campaign: attribution.utm_campaign ?? null,
    utm_content: attribution.utm_content ?? null,
    utm_term: attribution.utm_term ?? null,
    click_id: attribution.click_id ?? null,
    referrer: attribution.referrer ?? null,
    channel: attribution.channel ?? null,
    landing_path: attribution.landing_path ?? null,
  };
}

/** GET /api/users — paginated list. */
export const GET: APIRoute = async ({ url }) => {
  try {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const { users, total } = await userDb.list(limit, offset, {
      search: url.searchParams.get('search'),
      channel: url.searchParams.get('channel'),
      icp_focus: url.searchParams.get('icp_focus'),
      experiment_id: url.searchParams.get('experiment_id'),
    });

    return json({ success: true, data: users, pagination: { limit, offset, total } }, 200);
  } catch (error) {
    console.error('[api/users] GET failed:', error);
    return json({ success: false, error: 'Failed to retrieve users' }, 500);
  }
};

/** POST /api/users — create a user from the signup flow. */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const input = CreateUserSchema.parse(payload);
    const context = await buildSignupContext(cookies, url.searchParams.get('lp'));

    const user = await userDb.create(input, context);

    // Canonical conversion event — emitted server-side so ad blockers cannot suppress it.
    //
    // `variant_id` must be the same value the client stamps on `experiment_variant_exposed`
    // (COPY_DICTIONARY[key].variant_id), or the exposure and the conversion land under
    // different breakdown values and the funnel silently reports a 0% rate for every
    // non-control arm. `variant_key` rides along for joins back to the database.
    const variantCopy = context.variant_key ? COPY_DICTIONARY[context.variant_key] : undefined;

    await captureServerEvent({
      event: 'signup_completed',
      distinctId: context.visitor_id ?? user.id,
      properties: {
        user_id: user.id,
        icp_focus: user.icp_focus,
        experiment_id: context.experiment_id,
        variant_id: variantCopy?.variant_id ?? context.variant_key,
        variant_key: context.variant_key,
        // Queried directly rather than via distinct_id, so exposures and conversions
        // are counted over the same identifier.
        visitor_id: context.visitor_id,
        channel: context.channel,
        utm_source: context.utm_source,
        utm_medium: context.utm_medium,
        utm_campaign: context.utm_campaign,
      },
    });

    return json({ success: true, data: user }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      // Field-keyed errors so the form can highlight the offending input.
      return json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: error.flatten().fieldErrors,
        },
        400
      );
    }

    if (error instanceof DuplicateEmailError) {
      return json(
        {
          success: false,
          error: 'An account with this email already exists',
          fieldErrors: { email: ['An account with this email already exists'] },
        },
        409
      );
    }

    console.error('[api/users] POST failed:', error);
    return json({ success: false, error: 'Failed to create account' }, 500);
  }
};
