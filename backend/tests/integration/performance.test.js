import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { clearAuthCache } from '../../src/middleware/auth.js';
import { Booking } from '../../src/models/Booking.js';
import { User } from '../../src/models/User.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createBookingDoc, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
  await clearDb();
  clearAuthCache();
});
afterEach(() => vi.restoreAllMocks());

describe('HTTP caching headers', () => {
  it('lets browsers cache public restaurant data briefly', async () => {
    const owner = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    for (const path of ['/api/restaurants', `/api/restaurants/${restaurant._id}`, `/api/restaurants/${restaurant._id}/menu`]) {
      const res = await request(app).get(path);
      expect(res.headers['cache-control']).toMatch(/public/);
      expect(res.headers['cache-control']).toMatch(/max-age=30/);
    }
  });

  it('never caches private or fast-changing responses', async () => {
    const owner = await createUser('owner');
    const diner = await createUser('diner');
    const restaurant = await createRestaurant(owner);
    const paths = [
      ['/api/health', null],
      ['/api/bookings/mine', diner],
      ['/api/auth/me', diner],
      [`/api/restaurants/${restaurant._id}/availability?date=2099-06-15&partySize=2`, null],
    ];
    for (const [path, user] of paths) {
      const req = request(app).get(path);
      const res = await (user ? req.set(authHeader(user)) : req);
      expect(res.headers['cache-control'], path).toMatch(/no-store/);
    }
  });
});

describe('compression', () => {
  it('gzips larger JSON responses', async () => {
    const owner = await createUser('owner');
    for (let i = 0; i < 12; i += 1) await createRestaurant(owner, { description: 'A reasonably long description. '.repeat(8) });
    const res = await request(app).get('/api/restaurants?limit=12').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.data.items).toHaveLength(12);
  });
});

describe('auth user cache', () => {
  it('looks the user up once for repeated requests, not on every request', async () => {
    const diner = await createUser('diner');
    const spy = vi.spyOn(User, 'findById');
    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).get('/api/auth/me').set(authHeader(diner))).status).toBe(200);
    }
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still rejects an unknown user id even with a valid signature', async () => {
    const ghost = new User({ name: 'Ghost', email: 'g@example.com', passwordHash: 'x', role: 'diner' });
    expect((await request(app).get('/api/auth/me').set(authHeader(ghost))).status).toBe(401);
  });
});

describe('availability is a pure read', () => {
  it('treats an expired hold as free without writing to the database', async () => {
    const owner = await createUser('owner');
    const diner = await createUser('diner');
    const restaurant = await createRestaurant(owner);
    const table = await createTable(restaurant, { seats: 4 });
    const stale = await createBookingDoc({
      restaurant, table, diner, status: 'pending_payment', holdExpiresAt: new Date('2000-01-01'),
    });
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/availability?date=2099-06-15&partySize=2`);
    const slot = res.body.data.slots.find((s) => s.slotStart === '19:00');
    expect(slot.isAvailable).toBe(true);
    expect((await Booking.findById(stale._id)).status).toBe('pending_payment');
  });
});
