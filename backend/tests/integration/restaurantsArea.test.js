import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Restaurant } from '../../src/models/Restaurant.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('restaurant area and sample flags', () => {
  it('stores an optional area and defaults source and isSample', async () => {
    const owner = await createUser('owner');
    const res = await request(app)
      .post('/api/restaurants')
      .set(authHeader(owner))
      .send({
        name: 'Corner Cafe', cuisine: 'Cafe', city: 'Bangalore', address: '1 MG Road', area: 'Indiranagar',
        openTime: '12:00', closeTime: '22:00', slotMinutes: 60,
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ area: 'Indiranagar', source: 'owner', isSample: false });
  });

  it('matches the search query against area as well as name', async () => {
    const owner = await createUser('owner');
    await createRestaurant(owner, { name: 'Alpha', area: 'Indiranagar' });
    await createRestaurant(owner, { name: 'Beta', area: 'Jayanagar' });
    const res = await request(app).get('/api/restaurants?q=indira');
    expect(res.body.data.items.map((r) => r.name)).toEqual(['Alpha']);
  });

  it('still treats regex characters in q literally', async () => {
    const owner = await createUser('owner');
    await createRestaurant(owner, { name: 'Cafe (Main)', area: 'Koramangala' });
    const res = await request(app).get('/api/restaurants').query({ q: 'Cafe (' });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('enforces a unique externalId but allows many restaurants without one', async () => {
    const owner = await createUser('owner');
    const base = {
      owner: owner._id, cuisine: 'Indian', city: 'Bangalore', address: 'x',
      openTime: '12:00', closeTime: '22:00', slotMinutes: 60,
    };
    await Restaurant.create({ ...base, name: 'One', externalId: 'node/1' });
    await expect(Restaurant.create({ ...base, name: 'Two', externalId: 'node/1' })).rejects.toMatchObject({ code: 11000 });
    await expect(Restaurant.create({ ...base, name: 'Three' })).resolves.toBeDefined();
    await expect(Restaurant.create({ ...base, name: 'Four' })).resolves.toBeDefined();
  });
});
