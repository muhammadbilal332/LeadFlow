import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as notificationRepo from '../repositories/notificationRepo';
import { NotFoundError } from '../utils/appError';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const [notifications, unreadCount] = await Promise.all([
    notificationRepo.listNotifications(req.user!.userId, req.user!.businessId),
    notificationRepo.countUnread(req.user!.userId, req.user!.businessId),
  ]);
  res.json({ notifications, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationRepo.markRead(req.params.id, req.user!.userId, req.user!.businessId);
  if (!notification) throw new NotFoundError('Notification not found');
  res.json({ notification });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const updated = await notificationRepo.markAllRead(req.user!.userId, req.user!.businessId);
  res.json({ updated });
});
