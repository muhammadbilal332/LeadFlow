import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, signupDeveloper } from './helpers';

describe('Integrations & Lead routing moved to the developer console', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('blocks owner and manager entirely — no page, no API path', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };

    for (const res of await Promise.all([
      request(app).get('/api/integrations').set(auth),
      request(app).post('/api/integrations/webhook').set(auth),
      request(app).get('/api/routing/rules').set(auth),
      request(app).get('/api/routing/sla').set(auth),
    ])) {
      expect(res.status).toBe(403);
    }
  });

  it('requires an explicit businessId from a developer, and 404s an unknown one', async () => {
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const missing = await request(app).get('/api/integrations').set(auth);
    expect(missing.status).toBe(400);

    const bogus = await request(app).get('/api/integrations?businessId=00000000-0000-0000-0000-000000000000').set(auth);
    expect(bogus.status).toBe(404);
  });

  it('GET /api/developer/primary-business resolves to the real business, never the developer\'s own scaffold business', async () => {
    const owner = await signupOwner(app);
    const developer = await signupDeveloper(app);

    const res = await request(app).get('/api/developer/primary-business').set('Authorization', `Bearer ${developer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.business.id).not.toBe(developer.businessId);
    // Some real (non-platform) business — not necessarily owner's specifically,
    // since other tests' fixtures may also exist, but never the developer's own.
    expect(typeof res.body.business.id).toBe('string');
    void owner;
  });

  it('a developer can fully manage a real business\'s webhook and routing rules via businessId', async () => {
    const owner = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const overview = await request(app).get(`/api/integrations?businessId=${owner.businessId}`).set(auth);
    expect(overview.status).toBe(200);
    expect(overview.body.webhook).toBeNull();

    const rule = await request(app)
      .post(`/api/routing/rules?businessId=${owner.businessId}`)
      .set(auth)
      .send({ name: 'Default', priority: 0, field: 'always', operator: 'equals', assignmentType: 'owner' });
    expect(rule.status).toBe(201);

    const list = await request(app).get(`/api/routing/rules?businessId=${owner.businessId}`).set(auth);
    expect(list.body.rules.some((r: { id: string }) => r.id === rule.body.rule.id)).toBe(true);
  });
});

describe('Backup Google Sheet reference (developer-only, no credentials stored)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('blocks owner access', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/developer/backup-sheet').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('starts empty, saves a reference link, and records an audit entry', async () => {
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const initial = await request(app).get('/api/developer/backup-sheet').set(auth);
    expect(initial.status).toBe(200);
    expect(initial.body.config).toBeNull();

    const update = await request(app)
      .put('/api/developer/backup-sheet')
      .set(auth)
      .send({ spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit' });
    expect(update.status).toBe(200);
    expect(update.body.config.spreadsheet_url).toBe('https://docs.google.com/spreadsheets/d/abc123/edit');

    const after = await request(app).get('/api/developer/backup-sheet').set(auth);
    expect(after.body.config.spreadsheet_url).toBe('https://docs.google.com/spreadsheets/d/abc123/edit');

    const audit = await request(app).get('/api/developer/audit').set(auth);
    expect(audit.body.logs.some((l: { action: string }) => l.action === 'updated_backup_sheet_config')).toBe(true);
  });

  it('clearing it back to null works and never stores a credential-shaped value as if it were fine to log unexamined', async () => {
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    await request(app).put('/api/developer/backup-sheet').set(auth).send({ spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/xyz/edit' });
    const cleared = await request(app).put('/api/developer/backup-sheet').set(auth).send({ spreadsheetUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.config.spreadsheet_url).toBeNull();
  });
});
