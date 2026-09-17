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
