import { z } from 'zod';

/**
 * API contracts for /api/users.
 *
 * The request schema covers only what the client is allowed to supply. Experiment
 * assignment and marketing attribution are read server-side from cookies, so a caller
 * cannot spoof which arm converted them or which channel acquired them.
 */

/** "Primary trading goal" — mirrors the ICP segments in the `icps` table. */
export const IcpFocusSchema = z
  .enum(['prop_firm', 'weekend', 'systematizer', 'general'])
  .default('general');

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80, 'Name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(254, 'Email is too long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password is too long'),
  icp_focus: IcpFocusSchema,
});

export const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    icp_focus: IcpFocusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

/** Server-side context attached to a signup; never accepted from the request body. */
export interface SignupContext {
  visitor_id: string | null;
  experiment_id: string | null;
  variant_key: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  click_id: string | null;
  referrer: string | null;
  channel: string | null;
  landing_path: string | null;
}

/**
 * Public user shape. Deliberately omits `password` — the stored credential must never
 * be echoed back by the API, including in the 201 response to the signup that set it.
 */
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  icp_focus: z.string(),
  visitor_id: z.string().nullable(),
  experiment_id: z.string().nullable(),
  variant_id: z.string().nullable(),
  utm_source: z.string().nullable(),
  utm_medium: z.string().nullable(),
  utm_campaign: z.string().nullable(),
  channel: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type IcpFocus = z.infer<typeof IcpFocusSchema>;
export type User = z.infer<typeof UserResponseSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Admin contracts for /api/admin/experiments.
 *
 * These arrive from HTML forms as well as JSON, so every field is coerced from a
 * string. Validating here rather than in the route keeps the same rules applying
 * to both callers.
 * ──────────────────────────────────────────────────────────────────────────── */

export const ExperimentStatusSchema = z.enum([
  'draft',
  'running',
  'paused',
  'completed',
  'winner_promoted',
  'killed',
]);

/**
 * The experiment id is the public `?lp=` value, not a surrogate key, so it is
 * constrained to what is safe to put in an ad URL.
 */
const ExperimentIdSchema = z
  .string()
  .trim()
  .min(1, 'Experiment id is required')
  .max(50, 'Experiment id is too long')
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use letters, numbers, hyphens or underscores only');

const PercentSchema = z.coerce
  .number()
  .min(0, 'Must be 0 or more')
  .max(100, 'Must be 100 or less');

export const CreateExperimentSchema = z.object({
  id: ExperimentIdSchema,
  name: z.string().trim().min(3, 'Name is too short').max(255),
  hypothesis: z.string().trim().min(10, 'State the hypothesis being tested').max(2000),
  icp_id: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((value) => (value ? value : null)),
  status: ExperimentStatusSchema.default('draft'),
  primary_metric: z.string().trim().min(1).max(100).default('signup_completed'),
  baseline_cr: PercentSchema.nullable().optional().default(null),
  target_cr: PercentSchema.nullable().optional().default(null),
  /** Comma-separated COPY_DICTIONARY keys for the non-control arms, e.g. "2,3". */
  variant_keys: z.string().trim().default(''),
});

export const UpdateExperimentSchema = z
  .object({
    name: z.string().trim().min(3).max(255).optional(),
    hypothesis: z.string().trim().min(10).max(2000).optional(),
    icp_id: z.string().trim().max(50).optional(),
    status: ExperimentStatusSchema.optional(),
    primary_metric: z.string().trim().min(1).max(100).optional(),
    baseline_cr: PercentSchema.nullable().optional(),
    target_cr: PercentSchema.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const CreateVariantSchema = z.object({
  variant_key: z
    .string()
    .trim()
    .min(1, 'Variant key is required')
    .max(50)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use letters, numbers, hyphens or underscores only'),
  variant_name: z.string().trim().min(2, 'Name the arm').max(100),
  is_control: z.coerce.boolean().default(false),
  weight: z.coerce.number().int().min(0).max(100).default(50),
  active: z.coerce.boolean().default(true),
});

export const UpdateVariantSchema = z
  .object({
    variant_name: z.string().trim().min(2).max(100).optional(),
    weight: z.coerce.number().int().min(0).max(100).optional(),
    active: z.coerce.boolean().optional(),
    is_control: z.coerce.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export type CreateExperimentPayload = z.infer<typeof CreateExperimentSchema>;
export type UpdateExperimentPayload = z.infer<typeof UpdateExperimentSchema>;
export type CreateVariantPayload = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantPayload = z.infer<typeof UpdateVariantSchema>;
