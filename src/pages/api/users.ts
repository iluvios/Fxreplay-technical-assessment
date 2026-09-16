import type { APIRoute } from 'astro';
import { userDb } from '../../lib/db';
import { CreateUserSchema } from '../../lib/schemas';
import { ZodError } from 'zod';

export const prerender = false;

// GET /api/users - List users with pagination
export const GET: APIRoute = async ({ url }) => {
  try {
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const result = await userDb.list(limit, offset);

    return new Response(JSON.stringify({
      success: true,
      data: result.users,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve users',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST /api/users - Create a new user from signup flow
export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid Content-Type. Must be application/json.',
      }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);

    const createdUser = await userDb.create(validatedData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account created successfully. Welcome to FX Replay Free!',
      data: createdUser,
    }), {
      status: 201,
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

    if (error instanceof Error && error.message.includes('already exists')) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error while creating user',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
