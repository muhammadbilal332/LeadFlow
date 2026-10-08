import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createUserSchema, updateUserSchema } from '../validation/schemas';
import * as userRepo from '../repositories/userRepo';
import { hashPassword } from '../utils/password';
import { ConflictError, NotFoundError } from '../utils/appError';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await userRepo.listUsersByBusiness(req.user!.businessId);
  res.json({ users });
});

export const createSalesUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);

  const existing = await userRepo.findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userRepo.createUser({
    businessId: req.user!.businessId,
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
  });

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.is_active },
  });
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const updated = await userRepo.updateUser(req.params.id, req.user!.businessId, input);
  if (!updated) throw new NotFoundError('User not found');
  res.json({ user: updated });
});
