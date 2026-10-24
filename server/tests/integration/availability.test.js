import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { createBookingDoc, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('GET /api/restaurants/:id/availability', () => {
  it('is public and reflects bookings', async () => {
    const owner = await createUser('owner');
    const diner = await createUser('diner');
    const restaurant = await createRestaurant(owner);
    const table = await createTable(restaurant, { seats: 4 });
    await createBookingDoc({ restaurant, table, diner, slotStart: '19:00' });

    const res = await request(app).get(`/api/restaurants/${restaurant._id}/availability?date=2099-06-15&partySize=2`);
    expect(res.status).toBe(200);
    const slots = Object.fromEntries(res.body.data.slots.map((s) => [s.slotStart, s.isAvailable]));
    expect(slots['19:00']).toBe(false);
    expect(slots['20:00']).toBe(true);
    expect(res.body.data.slots).toHaveLength(11);
  });

  it('returns 404 for an unknown restaurant', async () => {
    const res = await request(app).get('/api/restaurants/64b7f0c2a1b2c3d4e5f60718/availability?date=2099-06-15&partySize=2');
    expect(res.status).toBe(404);
  });

  it.each([
    ['bad date', 'date=2099-02-30&partySize=2'],
    ['missing date', 'partySize=2'],
    ['zero party', 'date=2099-06-15&partySize=0'],
    ['huge party', 'date=2099-06-15&partySize=500'],
    ['fractional party', 'date=2099-06-15&partySize=1.5'],
  ])('rejects %s with 400', async (_label, query) => {
    const owner = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/availability?${query}`);
    expect(res.status).toBe(400);
  });
});
