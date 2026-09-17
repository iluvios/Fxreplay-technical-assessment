/**
 * Shared plumbing for the /api/admin routes.
 *
 * Each route has two callers: the no-JS admin forms, which need a 303 back to the page
 * they came from, and anything speaking JSON (curl, the CLI, a future client). Rather
 * than duplicate every endpoint, the handlers negotiate on content type — a form post
 * gets a redirect carrying a human-readable message, a JSON post gets a JSON body.
 */

export interface ParsedRequest {
  fields: Record<string, string>;
  /** True when the caller was an HTML form, so it expects a redirect rather than JSON. */
  isForm: boolean;
}

/**
 * Read a request body as flat string fields, whether it arrived as a form or JSON.
 *
 * A body-less request (DELETE, or a JSON caller sending nothing) parses to no fields
 * rather than throwing — the routes treat an empty payload as a valid no-argument call.
 */
export async function parseRequest(request: Request): Promise<ParsedRequest> {
  const contentType = request.headers.get('content-type') ?? '';
  // Browsers only ever send these two for a <form>, so anything else — including a
  // body-less curl DELETE — is treated as a JSON caller and gets a JSON response.
  const isForm =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');
  const fields: Record<string, string> = {};

  try {
    if (!isForm) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body ?? {})) {
        if (value !== null && value !== undefined) fields[key] = String(value);
      }
    } else {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') fields[key] = value;
      }
    }
  } catch {
    // Empty or malformed body — fall through with no fields.
  }

  return { fields, isForm };
}

export const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * 303 rather than 302: the browser must follow up with a GET, so a refresh on the
 * destination does not re-submit the form and repeat a destructive action.
 */
export const redirectTo = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path } });

function withMessage(path: string, key: 'ok' | 'err', message: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}

/** Success: redirect a form back with a notice, or answer JSON. */
export function ok(parsed: ParsedRequest, returnTo: string, message: string, data?: unknown) {
  return parsed.isForm
    ? redirectTo(withMessage(returnTo, 'ok', message))
    : json({ success: true, message, data }, 200);
}

/** Failure: same negotiation, so a bad form post lands back on the page it came from. */
export function fail(parsed: ParsedRequest, returnTo: string, message: string, status = 400) {
  return parsed.isForm
    ? redirectTo(withMessage(returnTo, 'err', message))
    : json({ success: false, error: message }, status);
}

/** Parse a decimal field, treating blank as "not provided". */
export function optionalNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Checkbox semantics: present and truthy means on, absent means off. */
export function checkbox(value: string | undefined): boolean {
  return value === 'on' || value === 'true' || value === '1';
}
