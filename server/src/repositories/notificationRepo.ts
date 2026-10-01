import { query } from '../db/pool';

export interface NotificationRow {
  id: string;
  business_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function createNotification(input: {
  businessId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}): Promise<NotificationRow> {
  const result = await query<NotificationRow>(
    `INSERT INTO notifications (business_id, user_id, type, title, message, link)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.businessId, input.userId, input.type, input.title, input.message, input.link ?? null]
  );
  return result.rows[0];
}

export async function listNotifications(userId: string, businessId: string, limit = 50): Promise<NotificationRow[]> {
  const result = await query<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT $3`,
    [userId, businessId, limit]
  );
  return result.rows;
}

export async function countUnread(userId: string, businessId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND business_id = $2 AND is_read = false`,
    [userId, businessId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function markRead(id: string, userId: string, businessId: string): Promise<NotificationRow | null> {
  const result = await query<NotificationRow>(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 AND business_id = $3 RETURNING *`,
    [id, userId, businessId]
  );
  return result.rows[0] ?? null;
}

export async function markAllRead(userId: string, businessId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND business_id = $2 AND is_read = false`,
    [userId, businessId]
  );
  return result.rowCount ?? 0;
}
