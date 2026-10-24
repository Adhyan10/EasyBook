import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { getGateway } from '../../src/gateway/index.js';
import { Booking } from '../../src/models/Booking.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function heldBooking() {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  await createTable(restaurant, { seats: 4 });
  const diner = await createUser('diner');
  const res = await request(app)
    .post('/api/bookings')
    .set(authHeader(diner))
    .send({ restaurantId: String(restaurant._id), date: '2099-06-15', slotStart: '19:00', partySize: 2 });
  return { owner, diner, created: res.body.data };
}

const getOrder = (user, bookingId) => request(app).get(`/api/bookings/${bookingId}/order`).set(authHeader(user));

describe('GET /api/bookings/:id/order', () => {
  it('returns the original payment order for a live hold so the diner can resume paying', async () => {
    const { diner, created } = await heldBooking();
    const res = await getOrder(diner, created.booking._id);
    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({
      orderId: created.order.orderId,
      amount: 5000,
      currency: 'INR',
      gateway: 'mock',
      keyId: getGateway().publicKey,
    });
    expect(res.body.data.booking.holdExpiresAt).toBe(created.booking.holdExpiresAt);
  });

  it("forbids other diners and owners, and 404s or 400s on bad ids", async () => {
    const { owner, created } = await heldBooking();
    const stranger = await createUser('diner');
    expect((await getOrder(stranger, created.booking._id)).status).toBe(403);
    expect((await getOrder(owner, created.booking._id)).status).toBe(403);
    expect((await getOrder(stranger, '64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await getOrder(stranger, 'nope')).status).toBe(400);
  });

  it('returns 409 once the hold has expired', async () => {
    const { diner, created } = await heldBooking();
    await Booking.updateOne({ _id: created.booking._id }, { holdExpiresAt: new Date('2000-01-01') });
    const res = await getOrder(diner, created.booking._id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('returns 409 for a booking that is already confirmed', async () => {
    const { diner, created } = await heldBooking();
    await Booking.updateOne({ _id: created.booking._id }, { status: 'confirmed', $unset: { holdExpiresAt: 1 } });
    expect((await getOrder(diner, created.booking._id)).status).toBe(409);
  });
});
