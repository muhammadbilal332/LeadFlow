import * as suppressionRepo from '../../repositories/suppressionRepo';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import { normalizeEmail } from '../../utils/normalize';
import { SuppressionReason } from '../../repositories/suppressionRepo';

/** Must be checked before every single send — permanent, business-scoped. */
export async function isSuppressed(businessId: string, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return true;
  return suppressionRepo.isSuppressed(businessId, normalized);
}

/**
 * Adds a permanent suppression and stops every in-flight sequence for that
 * email address across every campaign — an unsubscribe, bounce, or manual
 * suppression on one contact must not leave a scheduled send behind it.
 */
export async function suppress(businessId: string, email: string, reason: SuppressionReason, source?: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  await suppressionRepo.addSuppression({ businessId, normalizedEmail: normalized, reason, source });

  const contactStatus = reason === 'unsubscribe' ? 'unsubscribed' : reason === 'bounce' ? 'bounced' : 'suppressed';
  await outreachContactRepo.setStatusByEmail(businessId, normalized, contactStatus);

  const contact = await outreachContactRepo.findByNormalizedEmail(businessId, normalized);
  if (contact) {
    await campaignContactRepo.stopAllForContact(businessId, contact.id, reason);
  }
}
