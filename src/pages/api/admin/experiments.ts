import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import {
  experimentDb,
  invalidateRegistryCache,
  DuplicateExperimentError,
  type CreateVariantInput,
} from '../../../lib/experiment-repo';
import { CreateExperimentSchema } from '../../../lib/schemas';
import { COPY_DICTIONARY } from '../../../lib/copy-dictionary';
import { parseRequest, json, ok, fail } from '../../../lib/admin-api';

export const prerender = false;

const RETURN_TO = '/marketingengine/experiments';

/** GET /api/admin/experiments — every experiment with its arms. */
export const GET: APIRoute = async () => {
  try {
    return json({ success: true, data: await experimentDb.list() }, 200);
  } catch (error) {
    console.error('[api/admin/experiments] GET failed:', error);
    return json({ success: false, error: 'Failed to load experiments' }, 500);
  }
};

/**
 * POST /api/admin/experiments — create an experiment and its arms.
 *
 * A control arm is always created, because an experiment without one has nothing to
 * measure against and would make every downstream statistic undefined. Treatment arms
 * are named by COPY_DICTIONARY key: copy ships with the code, so an arm whose key has
 * no entry would silently render control copy while being recorded as a variant —
 * the worst kind of experiment bug, since the data looks fine.
 */
export const POST: APIRoute = async ({ request }) => {
  const parsed = await parseRequest(request);

  try {
    const input = CreateExperimentSchema.parse(parsed.fields);

    const treatmentKeys = input.variant_keys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    const unknown = treatmentKeys.filter((key) => !(key in COPY_DICTIONARY));
    if (unknown.length > 0) {
      return fail(
        parsed,
        RETURN_TO,
        `No copy defined for variant key(s): ${unknown.join(', ')}. ` +
          `Add them to src/lib/copy-dictionary.ts first.`
      );
    }

    // Even weights across all arms. Equal allocation reaches significance fastest for a
    // fixed volume of traffic; a skewed split is a deliberate later decision, editable
    // per-arm on the detail screen.
    const armCount = treatmentKeys.length + 1;
    const weight = Math.floor(100 / armCount);

    const variants: CreateVariantInput[] = [
      {
        variant_key: 'control',
        variant_name: 'Control',
        is_control: true,
        weight,
        active: true,
      },
      ...treatmentKeys.map((key) => ({
        variant_key: key,
        variant_name: COPY_DICTIONARY[key].hero.headline.slice(0, 100),
        is_control: false,
        weight,
        active: true,
      })),
    ];

    const created = await experimentDb.create(
      {
        id: input.id,
        name: input.name,
        hypothesis: input.hypothesis,
        icp_id: input.icp_id ?? null,
        status: input.status,
        primary_metric: input.primary_metric,
        baseline_cr: input.baseline_cr,
        target_cr: input.target_cr,
      },
      variants
    );

    invalidateRegistryCache();

    return ok(
      parsed,
      `/marketingengine/experiments/${created.id}`,
      `Experiment "${created.name}" created with ${variants.length} arms.`,
      created
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.errors[0];
      return fail(parsed, RETURN_TO, `${first.path.join('.')}: ${first.message}`);
    }
    if (error instanceof DuplicateExperimentError) {
      return fail(parsed, RETURN_TO, error.message, 409);
    }

    console.error('[api/admin/experiments] POST failed:', error);
    return fail(parsed, RETURN_TO, 'Failed to create experiment', 500);
  }
};
