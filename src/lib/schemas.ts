import { z } from 'zod';

export const UserRoleSchema = z.enum(['trader', 'prop_trader', 'mentor', 'analyst']).default('trader');
export const PlanTierSchema = z.enum(['free_trial', 'intermediate', 'pro']).default('free_trial');

export const CreateUserSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(80).trim(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  primaryMarket: z.enum(['forex', 'futures', 'crypto', 'stocks']).default('forex'),
  source: z.string().optional().default('marketing_landing_try_free'),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(80).trim().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  primaryMarket: z.enum(['forex', 'futures', 'crypto', 'stocks']).optional(),
  planTier: PlanTierSchema.optional(),
  onboardingCompleted: z.boolean().optional(),
  tradesReplayed: z.number().int().min(0).optional(),
});

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  experienceLevel: z.string(),
  primaryMarket: z.string(),
  planTier: PlanTierSchema,
  source: z.string(),
  utmSource: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  onboardingCompleted: z.boolean(),
  tradesReplayed: z.number(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type User = z.infer<typeof UserResponseSchema>;
