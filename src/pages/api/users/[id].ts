import type { APIRoute } from 'astro';
import { userDb } from '../../../lib/db';
import { UpdateUserSchema } from '../../../lib/schemas';
import { ZodError } from 'zod';

export const prerender = false;

// GET /api/users/[id] - Fetch single user
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await userDb.findById(id);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, data: user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// PUT /api/users/[id] - Update user profile / tier
export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const validatedData = UpdateUserSchema.parse(body);

    const updatedUser = await userDb.update(id, validatedData);
    if (!updatedUser) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validation failed',
        issues: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update user',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
