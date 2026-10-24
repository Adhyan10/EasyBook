import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { MenuItem } from '../../src/models/MenuItem.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createMenuItem, createRestaurant, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function setup() {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  return { owner, restaurant };
}

const add = (user, restaurant, body) =>
  request(app).post(`/api/restaurants/${restaurant._id}/menu`).set(authHeader(user)).send(body);

describe('GET /api/restaurants/:id/menu', () => {
  it('is public and returns the grouped menu', async () => {
    const { restaurant } = await setup();
    await createMenuItem(restaurant, { category: 'Starters', name: 'Soup', isSample: true });
    await createMenuItem(restaurant, { category: 'Mains', name: 'Curry', isSample: true });
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/menu`);
    expect(res.status).toBe(200);
    expect(res.body.data.isSample).toBe(true);
    expect(res.body.data.categories.map((c) => c.name)).toEqual(['Starters', 'Mains']);
  });

  it('returns an empty menu for a restaurant without items', async () => {
    const { restaurant } = await setup();
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/menu`);
    expect(res.body.data).toEqual({ isSample: false, categories: [] });
  });

  it('returns 404 for an unknown restaurant and 400 for a malformed id', async () => {
    expect((await request(app).get('/api/restaurants/64b7f0c2a1b2c3d4e5f60718/menu')).status).toBe(404);
    expect((await request(app).get('/api/restaurants/nope/menu')).status).toBe(400);
  });
});

describe('POST /api/restaurants/:id/menu', () => {
  it('lets the owner add an item with defaults', async () => {
    const { owner, restaurant } = await setup();
    const res = await add(owner, restaurant, { category: 'Starters', name: 'Soup', price: 120 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ price: 120, isVeg: true, isSample: false });
  });

  it.each([
    ['zero price', { price: 0 }],
    ['negative price', { price: -5 }],
    ['fractional price', { price: 12.5 }],
    ['string price', { price: '50' }],
    ['huge price', { price: 100001 }],
    ['empty name', { name: '' }],
    ['81 char name', { name: 'x'.repeat(81) }],
    ['missing category', { category: undefined }],
  ])('rejects %s with 400', async (_label, patch) => {
    const { owner, restaurant } = await setup();
    const res = await add(owner, restaurant, { category: 'Mains', name: 'Dish', price: 100, ...patch });
    expect(res.status).toBe(400);
    expect(await MenuItem.countDocuments()).toBe(0);
  });

  it('forbids diners and other owners, and rejects anonymous callers', async () => {
    const { restaurant } = await setup();
    const diner = await createUser('diner');
    const other = await createUser('owner');
    const body = { category: 'Mains', name: 'Dish', price: 100 };
    expect((await add(diner, restaurant, body)).status).toBe(403);
    expect((await add(other, restaurant, body)).status).toBe(403);
    expect((await request(app).post(`/api/restaurants/${restaurant._id}/menu`).send(body)).status).toBe(401);
  });
});

describe('PATCH and DELETE /api/menu-items/:id', () => {
  it('lets the owner edit an item and clears its sample flag', async () => {
    const { owner, restaurant } = await setup();
    const sample = await createMenuItem(restaurant, { price: 100, isSample: true });
    const res = await request(app).patch(`/api/menu-items/${sample._id}`).set(authHeader(owner)).send({ price: 150 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ price: 150, isSample: false });
  });

  it('rejects an empty patch, other owners, unknown and malformed ids', async () => {
    const { owner, restaurant } = await setup();
    const itemDoc = await createMenuItem(restaurant);
    const other = await createUser('owner');
    expect((await request(app).patch(`/api/menu-items/${itemDoc._id}`).set(authHeader(owner)).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/menu-items/${itemDoc._id}`).set(authHeader(other)).send({ price: 1 })).status).toBe(403);
    expect((await request(app).patch('/api/menu-items/64b7f0c2a1b2c3d4e5f60718').set(authHeader(owner)).send({ price: 1 })).status).toBe(404);
    expect((await request(app).patch('/api/menu-items/nope').set(authHeader(owner)).send({ price: 1 })).status).toBe(400);
  });

  it('lets the owner delete an item and blocks other owners', async () => {
    const { owner, restaurant } = await setup();
    const itemDoc = await createMenuItem(restaurant);
    const other = await createUser('owner');
    expect((await request(app).delete(`/api/menu-items/${itemDoc._id}`).set(authHeader(other))).status).toBe(403);
    expect((await request(app).delete(`/api/menu-items/${itemDoc._id}`).set(authHeader(owner))).status).toBe(200);
    const menu = await request(app).get(`/api/restaurants/${restaurant._id}/menu`);
    expect(menu.body.data.categories).toEqual([]);
  });
});
