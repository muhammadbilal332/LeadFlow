import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createApiKeySchema } from '../validation/schemas';
import * as apiKeyRepo from '../repositories/apiKeyRepo';
import { generateSecret, hashSecret } from '../utils/secrets';
import { NotFoundError } from '../utils/appError';

export const listApiKeys = asyncHandler(async (req: Request, res: Response) => {
  const keys = await apiKeyRepo.listApiKeys(req.user!.businessId);
  res.json({ apiKeys: keys });
});

export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
  const input = createApiKeySchema.parse(req.body);

  const secret = generateSecret(24);
  const keyPrefix = secret.slice(0, 8);
  const fullKey = `lf_${keyPrefix}_${secret.slice(8)}`;

  const created = await apiKeyRepo.createApiKey({
    businessId: req.user!.businessId,
    name: input.name,
    keyPrefix,
    keyHash: hashSecret(fullKey),
    createdBy: req.user!.userId,
  });
  const { key_hash: _keyHash, ...apiKey } = created;

  // The full key is only ever shown once, right here at creation time.
  res.status(201).json({ apiKey, key: fullKey });
});

export const revokeApiKey = asyncHandler(async (req: Request, res: Response) => {
  const revoked = await apiKeyRepo.revokeApiKey(req.params.id, req.user!.businessId);
  if (!revoked) throw new NotFoundError('API key not found');
  res.status(204).send();
});
