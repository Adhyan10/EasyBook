import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Booking } from '../../src/models/Booking.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser, seedConfirmedBooking } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function staleHold() {
  const owner = await createUser('owner');
  const diner = await createUser('diner');
  const restaurant = await createRestaurant(owner);
  const table = await createTable(restaurant);
  const { booking } = await seedConfirmedBooking({
    restaurant, table, diner, bookingStatus: 'pending_payment', paymentStatus: 'created', holdExpiresAt: new Date('2000-01-01'),
  });
  return { owner, diner, restaurant, booking };
}

describe('listing bookings is a pure read', () => {
  it("shows an ended hold as expired on the owner's day view without changing the database", async () => {
    const { owner, restaurant, booking } = await staleHold();
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/bookings?date=2099-06-15`).set(authHeader(owner));
    expect(res.body.data[0].status).toBe('expired');
    expect((await Booking.findById(booking._id)).status).toBe('pending_payment');
  });

  it("shows an ended hold as expired in the diner's bookings without changing the database", async () => {
    const { diner, booking } = await staleHold();
    const res = await request(app).get('/api/bookings/mine').set(authHeader(diner));
    expect(res.body.data[0].status).toBe('expired');
    expect((await Booking.findById(booking._id)).status).toBe('pending_payment');
  });

  it('still blocks other owners from the day view', async () => {
    const { restaurant } = await staleHold();
    const other = await createUser('owner');
    const res = await request(app).get(`/api/restaurants/${restaurant._id}/bookings?date=2099-06-15`).set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
