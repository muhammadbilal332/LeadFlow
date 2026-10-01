import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('Notifications', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('notifies a sales user when a lead is explicitly assigned to them', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Assigned Lead', source: 'Website', assignedUserId: sales.userId });

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications.some((n: { type: string }) => n.type === 'lead_assigned')).toBe(true);
    expect(res.body.unreadCount).toBeGreaterThan(0);
  });

  it('marks a notification as read', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);
    await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Another Assigned Lead', source: 'Website', assignedUserId: sales.userId });

    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${sales.token}`);
    const notificationId = list.body.notifications[0].id;

    const readRes = await request(app).patch(`/api/notifications/${notificationId}/read`).set('Authorization', `Bearer ${sales.token}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.is_read).toBe(true);
  });

  it('never shows one user notifications belonging to another business', async () => {
    const ownerA = await signupOwner(app);
    const salesA = await createSalesUser(app, ownerA.token);
    const ownerB = await signupOwner(app);
    const salesB = await createSalesUser(app, ownerB.token);

    await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'A Business Lead', source: 'Website', assignedUserId: salesA.userId });

    const bNotifications = await request(app).get('/api/notifications').set('Authorization', `Bearer ${salesB.token}`);
    expect(bNotifications.body.notifications.some((n: { message: string }) => n.message.includes('A Business Lead'))).toBe(false);
  });
});
