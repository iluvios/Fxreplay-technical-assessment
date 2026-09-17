import { defineMiddleware } from 'astro:middleware';
import { isSignedIn } from './lib/admin-auth';

/**
 * Gates the internal surfaces. Public routes (/, /freetrial, /signup, /api/users)
 * pass through untouched — nothing here may add latency to the landing pages.
 *
 * Browser routes redirect to the login screen; API routes answer 401 in JSON, so a
 * fetch or curl against them gets a usable error instead of an HTML login page.
 */

const PROTECTED_PAGE_PREFIX = '/marketingengine';
const PROTECTED_API_PREFIXES = ['/api/admin', '/api/engine'];

/** Reachable without a session: the login screen and the endpoint that creates one. */
const PUBLIC_ADMIN_PATHS = ['/marketingengine/login', '/api/admin/session'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return next();

  const isProtectedApi = PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isProtectedPage = pathname.startsWith(PROTECTED_PAGE_PREFIX);

  if (!isProtectedApi && !isProtectedPage) return next();

  if (isSignedIn(context.cookies)) return next();

  // The engine endpoints accept a bearer token as well as an admin session, so that
  // Vercel Cron and the CLI can trigger an evaluation without a browser. The token is
  // verified inside the route itself, which knows which secret applies.
  if (pathname.startsWith('/api/engine') && context.request.headers.get('authorization')) {
    return next();
  }

  // /api/engine/action is reached by clicking a link in an alert, so an unauthenticated
  // hit is a person who needs to log in, not a misbehaving client. The route sends them
  // to the login screen and back; answering 401 here would break that flow.
  if (pathname === '/api/engine/action') return next();

  if (isProtectedApi) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Carry the requested path so login can return the user where they were headed.
  const redirectTo = encodeURIComponent(context.url.pathname + context.url.search);
  return context.redirect(`/marketingengine/login?next=${redirectTo}`, 302);
});
