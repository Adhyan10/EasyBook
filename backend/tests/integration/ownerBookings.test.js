import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { resetGateway, setGateway } from '../../src/gateway/index.js';
import { createMockGateway } from '../../src/gateway/mockGateway.js';
import { Payment } from '../../src/models/Payment.js';
import { changeStatusAsOwner } from '../../src/services/bookingLifecycleService.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser, seedConfirmedBooking } from '../helpers/factories.js';

const app = createApp();
const AFTER_SLOT = new Date('2099-06-15T14:00:00Z'); // slot starts 13:30 UTC

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);
afterEach(resetGateway);

async function setup(seed = {}) {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  const table = await createTable(restaurant);
  const diner = await createUser('diner');
  const seeded = await seedConfirmedBooking({ restaurant, table, diner, ...seed });
  return { owner, restaurant, table, diner, ...seeded };
}

const setStatus = (user, booking, status) =>
  request(app).patch(`/api/bookings/${booking._id}/status`).set(authHeader(user)).send({ status });
const adjust = (user, booking) => request(app).patch(`/api/bookings/${booking._id}/adjust`).set(authHeader(user));

describe('GET /api/restaurants/:id/bookings', () => {
  it("lists the day's bookings with diner, table and deposit, sorted by time", async () => {
    const { owner, restaurant, table, diner } = await setup({ slotStart: '20:00' });
    await seedConfirmedBooking({ restaurant, table, diner, slotStart: '12:00' });
    await seedConfirmedBooking({ restaurant, table, diner, date: '2099-07-01' });

    const res = await request(app).get(`/api/restaurants/${restaurant._id}/bookings?date=2099-06-15`).set(authHeader(owner));
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.slotStart)).toEqual(['12:00', '20:00']);
    expect(res.body.data[0]).toMatchObject({
      diner: { name: diner.name },
      table: { label: table.label },
      deposit: { status: 'paid' },
    });
  });

  it('forbids other owners and diners, and validates the date', async () => {
    const { restaurant, diner } = await setup();
    const other = await createUser('owner');
    const url = `/api/restaurants/${restaurant._id}/bookings?date=2099-06-15`;
    expect((await request(app).get(url).set(authHeader(other))).status).toBe(403);
    expect((await request(app).get(url).set(authHeader(diner))).status).toBe(403);
    const bad = await request(app).get(`/api/restaurants/${restaurant._id}/bookings?date=bad`).set(authHeader(other));
    expect(bad.status).toBe(400);
  });
});

describe('PATCH /api/bookings/:id/status', () => {
  it('walks confirmed -> seated -> completed', async () => {
    const { owner, booking } = await setup();
    expect((await setStatus(owner, booking, 'seated')).body.data.booking.status).toBe('seated');
    expect((await setStatus(owner, booking, 'completed')).body.data.booking.status).toBe('completed');
  });

  it('rejects invalid transitions and unknown statuses', async () => {
    const { owner, booking } = await setup();
    expect((await setStatus(owner, booking, 'completed')).status).toBe(409);
    expect((await setStatus(owner, booking, 'confirmed')).status).toBe(400);
    expect((await setStatus(owner, booking, 'banana')).status).toBe(400);
  });

  it('forbids other owners and diners', async () => {
    const { booking, diner } = await setup();
    const other = await createUser('owner');
    expect((await setStatus(other, booking, 'seated')).status).toBe(403);
    expect((await setStatus(diner, booking, 'seated')).status).toBe(403);
  });

  it('refuses no-show before the slot starts', async () => {
    const { owner, booking } = await setup();
    expect((await setStatus(owner, booking, 'no_show')).status).toBe(422);
  });

  it('marks no-show after the slot and forfeits the deposit', async () => {
    const { owner, booking, payment } = await setup();
    const result = await changeStatusAsOwner({ bookingId: booking._id, ownerId: owner._id, nextStatus: 'no_show' }, AFTER_SLOT);
    expect(result.booking.status).toBe('no_show');
    expect((await Payment.findById(payment._id)).status).toBe('forfeited');
  });

  it('refunds in full when the owner cancels', async () => {
    const { owner, booking, payment } = await setup();
    const res = await setStatus(owner, booking, 'cancelled');
    expect(res.status).toBe(200);
    expect(res.body.data.deposit.status).toBe('refunded');
    expect((await Payment.findById(payment._id)).status).toBe('refunded');
  });
});

describe('PATCH /api/bookings/:id/adjust', () => {
  it('adjusts a paid deposit on a seated booking exactly once', async () => {
    const { owner, booking, payment } = await setup({ bookingStatus: 'seated' });
    const first = await adjust(owner, booking);
    expect(first.status).toBe(200);
    expect((await Payment.findById(payment._id)).adjustedAt).toBeInstanceOf(Date);
    expect((await adjust(owner, booking)).status).toBe(409);
  });

  it('rejects confirmed bookings, forfeited deposits and other owners', async () => {
    const confirmed = await setup();
    expect((await adjust(confirmed.owner, confirmed.booking)).status).toBe(409);

    const noShow = await setup({ bookingStatus: 'completed', paymentStatus: 'forfeited' });
    expect((await adjust(noShow.owner, noShow.booking)).status).toBe(409);

    const seated = await setup({ bookingStatus: 'seated' });
    const other = await createUser('owner');
    expect((await adjust(other, seated.booking)).status).toBe(403);
  });
});

describe('GET /api/restaurants/:id/deposits', () => {
  it('summarises the ledger for the owner only', async () => {
    const { owner, restaurant, table, diner } = await setup(); // paid, not adjusted: 50
    await seedConfirmedBooking({ restaurant, table, diner, date: '2099-07-01', bookingStatus: 'no_show', paymentStatus: 'forfeited' });
    await seedConfirmedBooking({ restaurant, table, diner, date: '2099-07-02', bookingStatus: 'cancelled', paymentStatus: 'refunded' });

    const res = await request(app).get(`/api/restaurants/${restaurant._id}/deposits`).set(authHeader(owner));
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      pendingAdjustment: 50, adjusted: 0, forfeited: 50, refunded: 50, refundFailed: 0,
    });
    expect(res.body.data.items).toHaveLength(3);

    const other = await createUser('owner');
    expect((await request(app).get(`/api/restaurants/${restaurant._id}/deposits`).set(authHeader(other))).status).toBe(403);
  });
});

describe('PATCH /api/bookings/:id/retry-refund', () => {
  const retry = (user, booking) => request(app).patch(`/api/bookings/${booking._id}/retry-refund`).set(authHeader(user));

  it('lets the owner retry a failed refund until it succeeds', async () => {
    const { owner, booking, payment } = await setup({ bookingStatus: 'cancelled', paymentStatus: 'refund_failed' });
    const res = await retry(owner, booking);
    expect(res.status).toBe(200);
    expect(res.body.data.deposit.status).toBe('refunded');
    expect((await Payment.findById(payment._id)).status).toBe('refunded');
  });

  it('keeps the payment as refund_failed when the gateway still fails', async () => {
    const { owner, booking, payment } = await setup({ bookingStatus: 'cancelled', paymentStatus: 'refund_failed' });
    setGateway({ ...createMockGateway(), refund: async () => { throw new Error('still down'); } });
    expect((await retry(owner, booking)).status).toBe(502);
    expect((await Payment.findById(payment._id)).status).toBe('refund_failed');
  });

  it('refuses payments that are not in a failed-refund state', async () => {
    const paid = await setup();
    expect((await retry(paid.owner, paid.booking)).status).toBe(409);
    const done = await setup({ bookingStatus: 'cancelled', paymentStatus: 'refunded' });
    expect((await retry(done.owner, done.booking)).status).toBe(409);
  });

  it('forbids other owners and diners, and rejects malformed ids', async () => {
    const { booking, diner } = await setup({ bookingStatus: 'cancelled', paymentStatus: 'refund_failed' });
    const other = await createUser('owner');
    expect((await retry(other, booking)).status).toBe(403);
    expect((await retry(diner, booking)).status).toBe(403);
    const bad = await request(app).patch('/api/bookings/nope/retry-refund').set(authHeader(other));
    expect(bad.status).toBe(400);
  });
});
