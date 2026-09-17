import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { userDb } from '../../../lib/db';
import { UpdateUserSchema } from '../../../lib/schemas';

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/users/:id */
export const GET: APIRoute = async ({ params }) => {
  const id = params.id;

  if (!id || !UUID_PATTERN.test(id)) {
    return json({ success: false, error: 'Invalid user id' }, 400);
  }

  try {
    const user = await userDb.findById(id);
    if (!user) return json({ success: false, error: 'User not found' }, 404);

    return json({ success: true, data: user }, 200);
  } catch (error) {
    console.error('[api/users/:id] GET failed:', error);
    return json({ success: false, error: 'Failed to retrieve user' }, 500);
  }
};

/** PATCH /api/users/:id — partial update. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id;

  if (!id || !UUID_PATTERN.test(id)) {
    return json({ success: false, error: 'Invalid user id' }, 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const input = UpdateUserSchema.parse(payload);
    const user = await userDb.update(id, input);

    if (!user) return json({ success: false, error: 'User not found' }, 404);

    return json({ success: true, data: user }, 200);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { success: false, error: 'Validation failed', fieldErrors: error.flatten().fieldErrors },
        400
      );
    }

    console.error('[api/users/:id] PATCH failed:', error);
    return json({ success: false, error: 'Failed to update user' }, 500);
  }
};
