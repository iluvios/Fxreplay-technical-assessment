import type { AstroCookies } from 'astro';

/**
 * Admin gate for /marketingengine.
 *
 * Deliberately trivial: one hardcoded credential pair, compared in plaintext, with a
 * cookie that just says "signed in". No hashing, no sessions table, no token rotation.
 *
 * This matches the posture of the rest of the assessment — `users.password` is stored
 * as provided for the same reason (scripts/schema.sql §4). A real deployment would put
 * the dashboard behind the company SSO rather than reimplement auth here, so building
 * a half-real auth layer would be effort spent on the one part of this system that
 * would certainly be thrown away.
 *
 * Credentials can be overridden by ADMIN_USER / ADMIN_PASSWORD without a code change.
 */

export const ADMIN_COOKIE = 'fxr_admin';

export const ADMIN_USER = process.env.ADMIN_USER ?? import.meta.env.ADMIN_USER ?? 'admin';

export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ?? import.meta.env.ADMIN_PASSWORD ?? 'fxreplay';

const SESSION_MAX_AGE = 60 * 60 * 8; // one working day

/** Plaintext comparison — see the note above. */
export function credentialsValid(username: string, password: string): boolean {
  return username === ADMIN_USER && password === ADMIN_PASSWORD;
}

export function isSignedIn(cookies: AstroCookies): boolean {
  return cookies.get(ADMIN_COOKIE)?.value === 'ok';
}

export function signIn(cookies: AstroCookies): void {
  cookies.set(ADMIN_COOKIE, 'ok', {
    path: '/',
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax',
    // httpOnly costs nothing here and keeps the cookie out of any third-party script
    // that ends up on the page.
    httpOnly: true,
    secure: import.meta.env.PROD,
  });
}

export function signOut(cookies: AstroCookies): void {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
}
