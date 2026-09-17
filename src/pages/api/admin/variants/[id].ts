import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { experimentDb, invalidateRegistryCache } from '../../../../lib/experiment-repo';
import { UpdateVariantSchema } from '../../../../lib/schemas';
import { parseRequest, ok, fail, checkbox, type ParsedRequest } from '../../../../lib/admin-api';

export const prerender = false;

/** Forms post the experiment id alongside, so the redirect lands on the right detail page. */
function returnPath(parsed: ParsedRequest): string {
  const experimentId = parsed.fields.experiment_id;
  return experimentId
    ? `/marketingengine/experiments/${experimentId}`
    : '/marketingengine/experiments';
}

async function applyUpdate(parsed: ParsedRequest, variantId: string) {
  const returnTo = returnPath(parsed);

  // `active` is a checkbox: its absence means off, which is a real value rather than
  // "unchanged". The form therefore always sends it explicitly via a hidden companion
  // field, and anything else blank is dropped as unchanged.
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.fields)) {
    if (['_method', 'experiment_id'].includes(key) || value === '') continue;
    fields[key] = key === 'active' || key === 'is_control' ? checkbox(value) : value;
  }

  try {
    const patch = UpdateVariantSchema.parse(fields);
    const variant = await experimentDb.updateVariant(variantId, patch);
    if (!variant) return fail(parsed, returnTo, 'Variant not found', 404);

    invalidateRegistryCache();

    const state = variant.active ? 'active' : 'paused — its traffic now falls back to control';
    return ok(parsed, returnTo, `"${variant.variant_name}" is ${state}.`, variant);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.errors[0];
      return fail(parsed, returnTo, `${first.path.join('.')}: ${first.message}`);
    }
    console.error('[api/admin/variants/:id] update failed:', error);
    return fail(parsed, returnTo, 'Failed to update variant', 500);
  }
}

async function applyDelete(parsed: ParsedRequest, variantId: string) {
  const returnTo = returnPath(parsed);
  const removed = await experimentDb.removeVariant(variantId);
  invalidateRegistryCache();

  return removed
    ? ok(parsed, returnTo, 'Arm deleted.')
    : fail(parsed, returnTo, 'Variant not found', 404);
}

/** POST /api/admin/variants/:id — `_method=delete` deletes, otherwise patches. */
export const POST: APIRoute = async ({ request, params }) => {
  const parsed = await parseRequest(request);
  return parsed.fields._method === 'delete'
    ? applyDelete(parsed, params.id!)
    : applyUpdate(parsed, params.id!);
};

export const PATCH: APIRoute = async ({ request, params }) =>
  applyUpdate(await parseRequest(request), params.id!);

export const DELETE: APIRoute = async ({ request, params }) =>
  applyDelete(await parseRequest(request), params.id!);
