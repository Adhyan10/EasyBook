import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createUser } from '../helpers/factories.js';

const app = createApp();
const valid = { name: 'Asha Rao', email: 'asha@example.com', password: 'password123', role: 'diner' };

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token without the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', role: 'diner' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password123/);
  });

  it('normalises email case and rejects duplicates with 409', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'ASHA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it.each([
    ['short password', { password: 'short' }],
    ['bad email', { email: 'not-an-email' }],
    ['admin role', { role: 'admin' }],
    ['missing name', { name: '' }],
  ])('rejects %s with 400', async (_label, patch) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const wrong = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'password123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user', async () => {
    const user = await createUser('owner');
    const res = await request(app).get('/api/auth/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: user.email, role: 'owner' });
  });

  it('rejects missing and garbage tokens with 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(bad.status).toBe(401);
  });
});
