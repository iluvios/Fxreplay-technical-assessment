import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { experimentDb, invalidateRegistryCache } from '../../../../../lib/experiment-repo';
import { CreateVariantSchema } from '../../../../../lib/schemas';
import { COPY_DICTIONARY } from '../../../../../lib/copy-dictionary';
import { parseRequest, ok, fail, checkbox } from '../../../../../lib/admin-api';

export const prerender = false;

/** POST /api/admin/experiments/:id/variants — add an arm to an existing experiment. */
export const POST: APIRoute = async ({ request, params }) => {
  const parsed = await parseRequest(request);
  const id = params.id!;
  const returnTo = `/marketingengine/experiments/${id}`;

  try {
    const input = CreateVariantSchema.parse({
      ...parsed.fields,
      // Unchecked boxes are absent from a form post entirely, so they must be resolved
      // to explicit booleans before Zod coerces them (coerce would read undefined as false
      // anyway, but being explicit keeps the two callers behaving identically).
      is_control: checkbox(parsed.fields.is_control),
      active: parsed.fields.active === undefined ? true : checkbox(parsed.fields.active),
    });

    if (!input.is_control && !(input.variant_key in COPY_DICTIONARY)) {
      return fail(
        parsed,
        returnTo,
        `No copy defined for "${input.variant_key}". Add it to src/lib/copy-dictionary.ts first.`
      );
    }

    const variant = await experimentDb.addVariant(id, input);
    if (!variant) return fail(parsed, returnTo, 'Experiment not found', 404);

    invalidateRegistryCache();
    return ok(parsed, returnTo, `Arm "${variant.variant_name}" added.`, variant);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.errors[0];
      return fail(parsed, returnTo, `${first.path.join('.')}: ${first.message}`);
    }
    console.error('[api/admin/experiments/:id/variants] POST failed:', error);
    return fail(parsed, returnTo, 'Failed to add variant', 500);
  }
};
