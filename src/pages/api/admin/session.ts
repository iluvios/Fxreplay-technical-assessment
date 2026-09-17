import type { APIRoute } from 'astro';
import { credentialsValid, signIn, signOut } from '../../../lib/admin-auth';
import { parseRequest, json, redirectTo } from '../../../lib/admin-api';

export const prerender = false;

/** POST /api/admin/session — sign in. `?_method=delete` signs out. */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  // HTML forms cannot issue DELETE, so sign-out tunnels through POST. Only this one
  // route honours the override, and only for a verb that needs no body.
  if (url.searchParams.get('_method') === 'delete') {
    signOut(cookies);
    return redirectTo('/marketingengine/login');
  }

  const parsed = await parseRequest(request);
  const { username = '', password = '', next = '/marketingengine' } = parsed.fields;

  if (!credentialsValid(username, password)) {
    return parsed.isForm
      ? redirectTo(`/marketingengine/login?err=1&next=${encodeURIComponent(next)}`)
      : json({ success: false, error: 'Invalid credentials' }, 401);
  }

  signIn(cookies);

  // `next` comes from the query string, so it must not be able to bounce a signed-in
  // session to another origin. Only same-site absolute paths are honoured.
  const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/marketingengine';

  return parsed.isForm ? redirectTo(destination) : json({ success: true }, 200);
};

/** DELETE /api/admin/session — sign out, for JSON callers. */
export const DELETE: APIRoute = async ({ cookies }) => {
  signOut(cookies);
  return json({ success: true }, 200);
};
