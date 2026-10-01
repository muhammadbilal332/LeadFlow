import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';

describe('Authentication', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('signs up a new business and owner, returns a token and no password hash', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      businessName: 'Acme Co',
      name: 'Owner Person',
      email: 'owner@acme.test',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('owner@acme.test');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects signup with mismatched passwords', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      businessName: 'Acme Co 2',
      name: 'Owner Person',
      email: 'owner2@acme.test',
      password: 'password123',
      confirmPassword: 'different',
    });
    expect(res.status).toBe(422);
  });

  it('rejects duplicate signup email', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      businessName: 'Acme Co',
      name: 'Owner Person',
      email: 'owner@acme.test',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'owner@acme.test',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'owner@acme.test',
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
    const login = await request(app).post('/api/auth/login').send({
      email: 'owner@acme.test',
      password: 'password123',
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('owner@acme.test');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects /api/auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects /api/auth/me with an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
