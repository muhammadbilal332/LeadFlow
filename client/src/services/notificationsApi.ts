import { apiRequest } from '../lib/api';
import { Notification } from '../types';

export function listNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
  return apiRequest('/notifications');
}

export function markNotificationRead(id: string): Promise<{ notification: Notification }> {
  return apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiRequest('/notifications/read-all', { method: 'POST' });
}
