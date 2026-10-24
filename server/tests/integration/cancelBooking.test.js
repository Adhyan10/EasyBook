import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { resetGateway, setGateway } from '../../src/gateway/index.js';
import { createMockGateway } from '../../src/gateway/mockGateway.js';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { cancelBookingAsDiner } from '../../src/services/bookingLifecycleService.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser, seedConfirmedBooking } from '../helpers/factories.js';

const app = createApp();
// 19:00 IST on 2099-06-15 is 13:30 UTC
const minutesBeforeSlot = (m) => new Date(new Date('2099-06-15T13:30:00Z').getTime() - m * 60_000);

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);
afterEach(resetGateway);

async function setup(seedOverrides = {}) {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  const table = await createTable(restaurant);
  const diner = await createUser('diner');
  const seeded = await seedConfirmedBooking({ restaurant, table, diner, ...seedOverrides });
  return { owner, restaurant, table, diner, ...seeded };
}

const cancel = (user, booking) => request(app).patch(`/api/bookings/${booking._id}/cancel`).set(authHeader(user));

describe('PATCH /api/bookings/:id/cancel', () => {
  it('cancels a far-off booking, refunds the deposit and frees the slot', async () => {
    const { diner, booking, payment, restaurant, table } = await setup();
    const res = await cancel(diner, booking);
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('cancelled');
    expect(res.body.data.deposit).toMatchObject({ status: 'refunded', amount: 50 });
    expect((await Payment.findById(payment._id)).status).toBe('refunded');

    const another = await createUser('diner');
    const rebook = await request(app).post('/api/bookings').set(authHeader(another))
      .send({ restaurantId: String(restaurant._id), date: booking.date, slotStart: booking.slotStart, partySize: 2 });
    expect(rebook.status).toBe(201);
    expect(String(rebook.body.data.table._id)).toBe(String(table._id));
  });

  it("forbids cancelling someone else's booking", async () => {
    const { booking } = await setup();
    const stranger = await createUser('diner');
    expect((await cancel(stranger, booking)).status).toBe(403);
  });

  it('returns 409 for pending and already-cancelled bookings', async () => {
    const pending = await setup({ bookingStatus: 'pending_payment', paymentStatus: 'created' });
    expect((await cancel(pending.diner, pending.booking)).status).toBe(409);
    const done = await setup({ bookingStatus: 'cancelled', paymentStatus: 'refunded' });
    expect((await cancel(done.diner, done.booking)).status).toBe(409);
  });

  it('returns 404 for unknown ids and 400 for malformed ones', async () => {
    const { diner } = await setup();
    const missing = await request(app).patch('/api/bookings/64b7f0c2a1b2c3d4e5f60718/cancel').set(authHeader(diner));
    expect(missing.status).toBe(404);
    const bad = await request(app).patch('/api/bookings/nope/cancel').set(authHeader(diner));
    expect(bad.status).toBe(400);
  });

  it('reports 502 but still cancels when the refund fails', async () => {
    const { diner, booking, payment } = await setup();
    setGateway({ ...createMockGateway(), refund: async () => { throw new Error('boom'); } });
    const res = await cancel(diner, booking);
    expect(res.status).toBe(502);
    expect((await Booking.findById(booking._id)).status).toBe('cancelled');
    expect((await Payment.findById(payment._id)).status).toBe('refund_failed');
  });
});

describe('cancelBookingAsDiner refund window', () => {
  it('refunds when cancelling 3 hours ahead', async () => {
    const { diner, booking } = await setup();
    const result = await cancelBookingAsDiner({ bookingId: booking._id, userId: diner._id }, minutesBeforeSlot(180));
    expect(result.deposit.status).toBe('refunded');
  });

  it('forfeits when cancelling 59 minutes ahead', async () => {
    const { diner, booking, payment } = await setup();
    const result = await cancelBookingAsDiner({ bookingId: booking._id, userId: diner._id }, minutesBeforeSlot(59));
    expect(result.deposit.status).toBe('forfeited');
    expect((await Payment.findById(payment._id)).status).toBe('forfeited');
  });

  it('refuses once the slot has started', async () => {
    const { diner, booking } = await setup();
    await expect(
      cancelBookingAsDiner({ bookingId: booking._id, userId: diner._id }, minutesBeforeSlot(-5)),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('GET /api/bookings/mine', () => {
  it("returns only the caller's bookings, newest first, with restaurant, table and deposit", async () => {
    const { diner, restaurant, table } = await setup();
    await seedConfirmedBooking({ restaurant, table, diner, date: '2099-07-01' });
    const other = await createUser('diner');
    await seedConfirmedBooking({ restaurant, table, diner: other, date: '2099-08-01' });

    const res = await request(app).get('/api/bookings/mine').set(authHeader(diner));
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.date)).toEqual(['2099-07-01', '2099-06-15']);
    expect(res.body.data[0]).toMatchObject({
      restaurant: { name: restaurant.name },
      table: { label: table.label },
      deposit: { amount: 50, status: 'paid' },
    });
  });

  it('expires abandoned holds before listing', async () => {
    const { diner, restaurant, table } = await setup();
    await seedConfirmedBooking({
      restaurant, table, diner, date: '2099-09-01', bookingStatus: 'pending_payment',
      paymentStatus: 'created', holdExpiresAt: new Date('2000-01-01'),
    });
    const res = await request(app).get('/api/bookings/mine').set(authHeader(diner));
    expect(res.body.data.find((b) => b.date === '2099-09-01').status).toBe('expired');
  });
});
