import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Authentication', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('logs in with correct credentials', async () => {
    const owner = await signupOwner(app, { email: 'owner@acme.test', password: 'password123' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'owner@acme.test',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.businessId).toBe(owner.businessId);
  });

  it('rejects login with wrong password', async () => {
    await signupOwner(app, { email: 'wrongpass@acme.test', password: 'password123' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'wrongpass@acme.test',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('rejects login for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@acme.test',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });

  it('returns the current user on /api/auth/me with a valid token, never a password hash', async () => {
    const owner = await signupOwner(app, { email: 'me-check@acme.test', password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({
      email: 'me-check@acme.test',
      password: 'password123',
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me-check@acme.test');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.business_id).toBe(owner.businessId);
  });

  it('rejects /api/auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects /api/auth/me with an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('no longer exposes public self-service business signup', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      businessName: 'Should Not Be Creatable',
      name: 'Nobody',
      email: 'nobody-new@acme.test',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(res.status).toBe(404);
  });
});
