import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { experimentDb, invalidateRegistryCache } from '../../../../lib/experiment-repo';
import { UpdateExperimentSchema } from '../../../../lib/schemas';
import { parseRequest, json, ok, fail, type ParsedRequest } from '../../../../lib/admin-api';

export const prerender = false;

/** GET /api/admin/experiments/:id */
export const GET: APIRoute = async ({ params }) => {
  const experiment = await experimentDb.get(params.id!);
  return experiment
    ? json({ success: true, data: experiment }, 200)
    : json({ success: false, error: 'Experiment not found' }, 404);
};

async function applyUpdate(parsed: ParsedRequest, id: string) {
  const returnTo = `/marketingengine/experiments/${id}`;

  // Blank inputs from a form mean "unchanged", not "set to empty". Stripping them
  // before validation is what makes one form able to edit any subset of fields.
  const fields = Object.fromEntries(
    Object.entries(parsed.fields).filter(
      ([key, value]) => value !== '' && !['_method', 'action', 'variant_id'].includes(key)
    )
  );

  try {
    const patch = UpdateExperimentSchema.parse(fields);
    const updated = await experimentDb.update(id, patch);
    if (!updated) return fail(parsed, returnTo, 'Experiment not found', 404);

    invalidateRegistryCache();
    return ok(parsed, returnTo, 'Experiment updated.', updated);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.errors[0];
      return fail(parsed, returnTo, `${first.path.join('.')}: ${first.message}`);
    }
    console.error('[api/admin/experiments/:id] update failed:', error);
    return fail(parsed, returnTo, 'Failed to update experiment', 500);
  }
}

async function applyDelete(parsed: ParsedRequest, id: string) {
  const removed = await experimentDb.remove(id);
  invalidateRegistryCache();

  return removed
    ? ok(parsed, '/marketingengine/experiments', `Experiment "${id}" deleted.`)
    : fail(parsed, '/marketingengine/experiments', 'Experiment not found', 404);
}

/**
 * Manually promote one arm to the whole allocation.
 *
 * The same operation the agent performs on an auto-promote, exposed here so a growth
 * engineer can act on an inconclusive test the agent handed back for review.
 */
async function applyPromote(parsed: ParsedRequest, id: string) {
  const returnTo = `/marketingengine/experiments/${id}`;
  const variantId = parsed.fields.variant_id;

  if (!variantId) return fail(parsed, returnTo, 'No variant selected to promote');

  const experiment = await experimentDb.get(id);
  const variant = experiment?.variants.find((candidate) => candidate.id === variantId);
  if (!experiment || !variant) return fail(parsed, returnTo, 'Variant not found', 404);

  const promoted = await experimentDb.promoteVariant(id, variantId);
  invalidateRegistryCache();

  await experimentDb.recordDecision({
    experiment_id: id,
    variant_id: variantId,
    decision: 'PROMOTE',
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
    rationale: 'Promoted manually from the admin console, bypassing the statistical gate.',
    ai_diagnosis: null,
    ai_model: null,
    action_taken: `"${variant.variant_name}" now serves 100% of traffic; all other arms deactivated.`,
    executed: true,
  });

  return ok(
    parsed,
    returnTo,
    `"${variant.variant_name}" promoted to 100% of traffic.`,
    promoted
  );
}

/** POST /api/admin/experiments/:id — form entry point; `_method` / `action` selects the operation. */
export const POST: APIRoute = async ({ request, params }) => {
  const parsed = await parseRequest(request);
  const id = params.id!;

  if (parsed.fields._method === 'delete') return applyDelete(parsed, id);
  if (parsed.fields.action === 'promote') return applyPromote(parsed, id);
  return applyUpdate(parsed, id);
};

export const PATCH: APIRoute = async ({ request, params }) =>
  applyUpdate(await parseRequest(request), params.id!);

export const DELETE: APIRoute = async ({ request, params }) =>
  applyDelete(await parseRequest(request), params.id!);
