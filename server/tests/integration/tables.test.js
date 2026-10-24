import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Booking } from '../../src/models/Booking.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function setup() {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  return { owner, restaurant };
}

describe('POST /api/restaurants/:id/tables', () => {
  it('lets the owner add a table', async () => {
    const { owner, restaurant } = await setup();
    const res = await request(app)
      .post(`/api/restaurants/${restaurant._id}/tables`)
      .set(authHeader(owner))
      .send({ label: 'Window 1', seats: 4 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ label: 'Window 1', seats: 4, isActive: true });
  });

  it('returns 409 for a duplicate label', async () => {
    const { owner, restaurant } = await setup();
    await createTable(restaurant, { label: 'T1' });
    const res = await request(app)
      .post(`/api/restaurants/${restaurant._id}/tables`)
      .set(authHeader(owner))
      .send({ label: 'T1', seats: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('A table with this label already exists');
  });

  it.each([[0], [-1], [2.5], [51]])('rejects seats=%s with 400', async (seats) => {
    const { owner, restaurant } = await setup();
    const res = await request(app)
      .post(`/api/restaurants/${restaurant._id}/tables`)
      .set(authHeader(owner))
      .send({ label: 'X', seats });
    expect(res.status).toBe(400);
  });

  it('forbids diners and other owners', async () => {
    const { restaurant } = await setup();
    const diner = await createUser('diner');
    const otherOwner = await createUser('owner');
    const url = `/api/restaurants/${restaurant._id}/tables`;
    expect((await request(app).post(url).set(authHeader(diner)).send({ label: 'A', seats: 2 })).status).toBe(403);
    expect((await request(app).post(url).set(authHeader(otherOwner)).send({ label: 'A', seats: 2 })).status).toBe(403);
    expect((await request(app).get(url).set(authHeader(otherOwner))).status).toBe(403);
  });
});

describe('GET /api/restaurants/:id/tables', () => {
  it('lists tables sorted by label', async () => {
    const { owner, restaurant } = await setup();
    await createTable(restaurant, { label: 'B' });
    await createTable(restaurant, { label: 'A' });
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/tables`).set(authHeader(owner));
    expect(res.body.data.map((t) => t.label)).toEqual(['A', 'B']);
  });
});

describe('PATCH and DELETE /api/tables/:id', () => {
  it('toggles isActive and edits seats', async () => {
    const { owner, restaurant } = await setup();
    const table = await createTable(restaurant);
    const res = await request(app).patch(`/api/tables/${table._id}`).set(authHeader(owner)).send({ isActive: false, seats: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ isActive: false, seats: 6 });
  });

  it('forbids another owner from editing or deleting', async () => {
    const { restaurant } = await setup();
    const table = await createTable(restaurant);
    const other = await createUser('owner');
    expect((await request(app).patch(`/api/tables/${table._id}`).set(authHeader(other)).send({ seats: 8 })).status).toBe(403);
    expect((await request(app).delete(`/api/tables/${table._id}`).set(authHeader(other))).status).toBe(403);
  });

  it('deletes a table with no upcoming bookings', async () => {
    const { owner, restaurant } = await setup();
    const table = await createTable(restaurant);
    const res = await request(app).delete(`/api/tables/${table._id}`).set(authHeader(owner));
    expect(res.status).toBe(200);
  });

  it('refuses to delete a table with an upcoming active booking', async () => {
    const { owner, restaurant } = await setup();
    const table = await createTable(restaurant);
    await Booking.create({
      restaurant: restaurant._id,
      table: table._id,
      diner: owner._id,
      date: '2099-06-15',
      slotStart: '19:00',
      partySize: 2,
      status: 'confirmed',
    });
    const res = await request(app).delete(`/api/tables/${table._id}`).set(authHeader(owner));
    expect(res.status).toBe(409);
  });
});
