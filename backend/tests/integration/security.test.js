import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closeTestDb, connectTestDb } from '../helpers/db.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);

describe('security headers and CORS', () => {
  const app = createApp();

  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured origin and not others', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('returns a 429 envelope after too many auth attempts', async () => {
    const app = createApp({ rateLimit: { authMax: 3, globalMax: 100 } });
    const attempt = () => request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever1' });
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
    const last = await attempt();
    expect(last.body).toEqual({ success: false, data: null, error: 'Too many requests. Please try again later.' });
  });
});
