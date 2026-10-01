import { z } from 'zod';

export const changeUserRoleSchema = z.object({
  role: z.enum(['owner', 'sales']),
});

export const setUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const leadFilterQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  businessId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const daysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
