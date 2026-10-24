import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { resetGateway, setGateway } from '../../src/gateway/index.js';
import { createMockGateway } from '../../src/gateway/mockGateway.js';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createBookingDoc, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();
const DATE = '2099-06-15';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);
afterEach(resetGateway);

const book = (diner, restaurant, overrides = {}) =>
  request(app)
    .post('/api/bookings')
    .set(authHeader(diner))
    .send({ restaurantId: String(restaurant._id), date: DATE, slotStart: '19:00', partySize: 2, ...overrides });

async function world(tableSeats = [4]) {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  const tables = [];
  for (const seats of tableSeats) tables.push(await createTable(restaurant, { seats }));
  return { owner, restaurant, tables };
}

describe('POST /api/bookings', () => {
  it('holds the smallest fitting table and returns a payment order', async () => {
    const { restaurant, tables } = await world([6, 2, 4]);
    const diner = await createUser('diner');
    const res = await book(diner, restaurant, { partySize: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('pending_payment');
    expect(String(res.body.data.table._id)).toBe(String(tables[2]._id)); // the 4-seater
    expect(res.body.data.depositAmount).toBe(75);
    expect(res.body.data.order).toMatchObject({ amount: 7500, currency: 'INR', gateway: 'mock' });
    const holdMs = new Date(res.body.data.booking.holdExpiresAt).getTime() - Date.now();
    expect(holdMs).toBeGreaterThan(9 * 60_000);
    expect(holdMs).toBeLessThanOrEqual(10 * 60_000);
    expect(await Payment.countDocuments({ status: 'created' })).toBe(1);
  });

  it('ignores any amount sent by the client', async () => {
    const { restaurant } = await world([4]);
    const diner = await createUser('diner');
    const res = await book(diner, restaurant, { amount: 1, depositAmount: 1 });
    expect(res.body.data.depositAmount).toBe(50);
  });

  it('returns 422 when no table can seat the party', async () => {
    const { restaurant } = await world([2]);
    const res = await book(await createUser('diner'), restaurant, { partySize: 5 });
    expect(res.status).toBe(422);
  });

  it.each([
    ['off-grid time', { slotStart: '19:30' }],
    ['closing time itself', { slotStart: '23:00' }],
    ['before opening', { slotStart: '11:00' }],
    ['past date', { date: '2000-01-01' }],
  ])('returns 422 for %s', async (_label, patch) => {
    const { restaurant } = await world([4]);
    const res = await book(await createUser('diner'), restaurant, patch);
    expect(res.status).toBe(422);
  });

  it('accepts the last valid slot', async () => {
    const { restaurant } = await world([4]);
    const res = await book(await createUser('diner'), restaurant, { slotStart: '22:00' });
    expect(res.status).toBe(201);
  });

  it.each([[0], [1.5], ['4'], [21], [-2]])('returns 400 for partySize=%j', async (partySize) => {
    const { restaurant } = await world([4]);
    const res = await book(await createUser('diner'), restaurant, { partySize });
    expect(res.status).toBe(400);
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('returns 400 for a malformed restaurant id and 404 for an unknown one', async () => {
    const diner = await createUser('diner');
    const bad = await request(app).post('/api/bookings').set(authHeader(diner))
      .send({ restaurantId: 'nope', date: DATE, slotStart: '19:00', partySize: 2 });
    expect(bad.status).toBe(400);
    const missing = await request(app).post('/api/bookings').set(authHeader(diner))
      .send({ restaurantId: '64b7f0c2a1b2c3d4e5f60718', date: DATE, slotStart: '19:00', partySize: 2 });
    expect(missing.status).toBe(404);
  });

  it('blocks owners and anonymous callers', async () => {
    const { owner, restaurant } = await world([4]);
    expect((await book(owner, restaurant)).status).toBe(403);
    const anon = await request(app).post('/api/bookings').send({});
    expect(anon.status).toBe(401);
  });

  it('lets exactly one of two simultaneous diners take the only table', async () => {
    const { restaurant } = await world([4]);
    const [a, b] = [await createUser('diner'), await createUser('diner')];
    const results = await Promise.all([book(a, restaurant), book(b, restaurant)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Booking.countDocuments({ status: 'pending_payment' })).toBe(1);
  });

  it('falls through to the next table when the first is taken, then 409s', async () => {
    const { restaurant } = await world([2, 4]);
    const diners = await Promise.all([1, 2, 3].map(() => createUser('diner')));
    const results = await Promise.all(diners.map((d) => book(d, restaurant)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 409]);
    const tablesUsed = new Set(results.filter((r) => r.status === 201).map((r) => r.body.data.table._id));
    expect(tablesUsed.size).toBe(2);
  });

  it('does not let a stale hold block the slot', async () => {
    const { restaurant, tables } = await world([4]);
    const first = await createUser('diner');
    await createBookingDoc({
      restaurant, table: tables[0], diner: first, status: 'pending_payment', holdExpiresAt: new Date('2000-01-01'),
    });
    const res = await book(await createUser('diner'), restaurant);
    expect(res.status).toBe(201);
  });

  it('lets a diner retry the same slot after abandoning payment', async () => {
    const { restaurant } = await world([4]);
    const diner = await createUser('diner');
    expect((await book(diner, restaurant)).status).toBe(201);
    const retry = await book(diner, restaurant);
    expect(retry.status).toBe(201);
    expect(await Booking.countDocuments({ status: 'expired' })).toBe(1);
  });

  it('rolls back the hold and returns 502 when the gateway is down', async () => {
    const { restaurant } = await world([4]);
    setGateway({ ...createMockGateway(), createOrder: async () => { throw new Error('gateway down'); } });
    const res = await book(await createUser('diner'), restaurant);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/try again/i);
    expect(await Booking.countDocuments()).toBe(0);
  });
});
