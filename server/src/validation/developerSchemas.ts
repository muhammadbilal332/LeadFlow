import { z } from 'zod';

export const changeUserRoleSchema = z.object({
  role: z.enum(['owner', 'sales']),
});

export const setUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const daysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
