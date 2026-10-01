import * as notificationRepo from '../repositories/notificationRepo';
import * as userRepo from '../repositories/userRepo';

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

export async function notifyUser(businessId: string, userId: string, input: NotificationInput): Promise<void> {
  await notificationRepo.createNotification({ businessId, userId, ...input });
}

/** Notifies the business owner — used when a lead has no assignee to notify directly. */
export async function notifyOwner(businessId: string, input: NotificationInput): Promise<void> {
  const owner = await userRepo.findOwnerByBusiness(businessId);
  if (!owner) return;
  await notifyUser(businessId, owner.id, input);
}
