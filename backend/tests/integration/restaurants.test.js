import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Booking } from '../../src/models/Booking.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createUser } from '../helpers/factories.js';

const app = createApp();
const payload = {
  name: 'Spice Route',
  cuisine: 'Indian',
  city: 'Pune',
  address: '12 FC Road',
  description: 'North Indian classics',
  openTime: '12:00',
  closeTime: '23:00',
  slotMinutes: 90,
};

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('POST /api/restaurants', () => {
  it('lets an owner create a restaurant owned by them', async () => {
    const owner = await createUser('owner');
    const res = await request(app).post('/api/restaurants').set(authHeader(owner)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Spice Route', depositPerPerson: 25 });
    expect(String(res.body.data.owner)).toBe(String(owner._id));
  });

  it('forbids diners and rejects anonymous callers', async () => {
    const diner = await createUser('diner');
    expect((await request(app).post('/api/restaurants').set(authHeader(diner)).send(payload)).status).toBe(403);
    expect((await request(app).post('/api/restaurants').send(payload)).status).toBe(401);
  });

  it.each([
    ['close before open', { openTime: '20:00', closeTime: '12:00' }],
    ['no room for one slot', { openTime: '12:00', closeTime: '13:00', slotMinutes: 90 }],
    ['slot too short', { slotMinutes: 10 }],
    ['bad time format', { openTime: '9am' }],
  ])('rejects %s with 400', async (_label, patch) => {
    const owner = await createUser('owner');
    const res = await request(app).post('/api/restaurants').set(authHeader(owner)).send({ ...payload, ...patch });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/restaurants', () => {
  it('filters by city, cuisine and name, and paginates', async () => {
    const owner = await createUser('owner');
    await createRestaurant(owner, { name: 'Alpha Grill', city: 'Pune', cuisine: 'BBQ' });
    await createRestaurant(owner, { name: 'Beta Bistro', city: 'Mumbai', cuisine: 'French' });
    await createRestaurant(owner, { name: 'Gamma Grill', city: 'Pune', cuisine: 'BBQ' });

    const pune = await request(app).get('/api/restaurants?city=pune');
    expect(pune.body.data.total).toBe(2);

    const grill = await request(app).get('/api/restaurants?q=GRILL&cuisine=bbq');
    expect(grill.body.data.items).toHaveLength(2);

    const page = await request(app).get('/api/restaurants?limit=2&page=2');
    expect(page.body.data).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(page.body.data.items).toHaveLength(1);
  });

  it('treats regex characters in q literally', async () => {
    const owner = await createUser('owner');
    await createRestaurant(owner, { name: 'Cafe (Main)' });
    const res = await request(app).get('/api/restaurants').query({ q: '(' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('GET /api/restaurants/mine and /:id', () => {
  it("lists only the caller's restaurants", async () => {
    const ownerA = await createUser('owner');
    const ownerB = await createUser('owner');
    await createRestaurant(ownerA);
    await createRestaurant(ownerB);
    const res = await request(app).get('/api/restaurants/mine').set(authHeader(ownerA));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('pages and searches the owner list so an owner with many restaurants gets small responses', async () => {
    const owner = await createUser('owner');
    const other = await createUser('owner');
    for (let i = 1; i <= 15; i += 1) await createRestaurant(owner, { name: `Place ${String(i).padStart(2, '0')}`, area: i === 3 ? 'Koramangala' : '' });
    await createRestaurant(other, { name: 'Not mine Koramangala', area: 'Koramangala' });

    const first = await request(app).get('/api/restaurants/mine?limit=10').set(authHeader(owner));
    expect(first.body.data).toMatchObject({ page: 1, limit: 10, total: 15 });
    expect(first.body.data.items).toHaveLength(10);
    const second = await request(app).get('/api/restaurants/mine?limit=10&page=2').set(authHeader(owner));
    expect(second.body.data.items).toHaveLength(5);

    const byArea = await request(app).get('/api/restaurants/mine?q=koramangala').set(authHeader(owner));
    expect(byArea.body.data.items.map((r) => r.name)).toEqual(['Place 03']);
    const byName = await request(app).get('/api/restaurants/mine?q=place%2007').set(authHeader(owner));
    expect(byName.body.data.total).toBe(1);
  });

  it('defaults to a small page and caps the page size', async () => {
    const owner = await createUser('owner');
    for (let i = 0; i < 12; i += 1) await createRestaurant(owner);
    const defaults = await request(app).get('/api/restaurants/mine').set(authHeader(owner));
    expect(defaults.body.data.limit).toBe(10);
    expect(defaults.body.data.items).toHaveLength(10);
    expect((await request(app).get('/api/restaurants/mine?limit=500').set(authHeader(owner))).status).toBe(400);
  });

  it('still forbids diners and anonymous callers', async () => {
    const diner = await createUser('diner');
    expect((await request(app).get('/api/restaurants/mine').set(authHeader(diner))).status).toBe(403);
    expect((await request(app).get('/api/restaurants/mine')).status).toBe(401);
  });

  it('returns 404 for a missing restaurant and 400 for a malformed id', async () => {
    const missing = await request(app).get('/api/restaurants/64b7f0c2a1b2c3d4e5f60718');
    expect(missing.status).toBe(404);
    const malformed = await request(app).get('/api/restaurants/not-an-id');
    expect(malformed.status).toBe(400);
  });
});

describe('PATCH /api/restaurants/:id', () => {
  it('lets the owner edit details', async () => {
    const owner = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    const res = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(owner)).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
  });

  it('forbids a different owner', async () => {
    const owner = await createUser('owner');
    const other = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    const res = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(other)).send({ name: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('rejects an empty update and an invalid merged schedule', async () => {
    const owner = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    const empty = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(owner)).send({});
    expect(empty.status).toBe(400);
    const bad = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(owner)).send({ closeTime: '11:00' });
    expect(bad.status).toBe(400);
  });

  it('blocks schedule changes while upcoming bookings exist', async () => {
    const owner = await createUser('owner');
    const restaurant = await createRestaurant(owner);
    await Booking.create({
      restaurant: restaurant._id,
      table: owner._id,
      diner: owner._id,
      date: '2099-06-15',
      slotStart: '19:00',
      partySize: 2,
      status: 'confirmed',
    });
    const res = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(owner)).send({ slotMinutes: 90 });
    expect(res.status).toBe(409);
    const harmless = await request(app).patch(`/api/restaurants/${restaurant._id}`).set(authHeader(owner)).send({ description: 'New text' });
    expect(harmless.status).toBe(200);
  });
});
