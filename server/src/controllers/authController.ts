import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, signupSchema } from '../validation/schemas';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { createBusiness, findBusinessById } from '../repositories/businessRepo';
import { createUser, findUserByEmail, findSafeUserById } from '../repositories/userRepo';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/appError';
import { logSystemEvent } from '../repositories/systemEventRepo';
import { logDeveloperAction } from '../repositories/developerAuditLogRepo';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const input = signupSchema.parse(req.body);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const business = await createBusiness({ name: input.businessName });
  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    businessId: business.id,
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'owner',
  });

  const token = signToken({ userId: user.id, businessId: business.id, role: user.role });

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, businessId: business.id },
    business: { id: business.id, name: business.name },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);

  const user = await findUserByEmail(input.email);
  if (!user || !user.is_active) {
    await logSystemEvent({ severity: 'warning', eventType: 'auth_failure', message: `Login failed for ${input.email} (no such active user)` });
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) {
    await logSystemEvent({ severity: 'warning', eventType: 'auth_failure', businessId: user.business_id, userId: user.id, message: `Login failed for ${input.email} (wrong password)` });
    throw new UnauthorizedError('Invalid email or password');
  }

  // A business deactivated by a developer blocks every one of its users
  // from logging in, even with correct credentials — same error message as
  // any other failure, so a locked-out account can't be distinguished from
  // a wrong password by probing.
  const business = await findBusinessById(user.business_id);
  if (!business || !business.is_active) {
    await logSystemEvent({ severity: 'warning', eventType: 'auth_failure', businessId: user.business_id, userId: user.id, message: `Login blocked for ${input.email} (business deactivated)` });
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken({ userId: user.id, businessId: user.business_id, role: user.role });

  if (user.role === 'developer') {
    await logDeveloperAction({ actorUserId: user.id, action: 'developer_login', targetType: 'session', ipAddress: req.ip ?? null });
  }

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, businessId: user.business_id },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await findSafeUserById(req.user!.userId, req.user!.businessId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json({ user });
});
