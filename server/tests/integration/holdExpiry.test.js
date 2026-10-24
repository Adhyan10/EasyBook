import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { expireStaleHolds, releaseDinerHolds } from '../../src/services/holdExpiry.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { createBookingDoc, createRestaurant, createTable, createUser } from '../helpers/factories.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function pendingBooking(holdExpiresAt, extra = {}) {
  const owner = await createUser('owner');
  const diner = await createUser('diner');
  const restaurant = await createRestaurant(owner);
  const table = await createTable(restaurant);
  const booking = await createBookingDoc({
    restaurant, table, diner, status: 'pending_payment', holdExpiresAt, ...extra,
  });
  await Payment.create({
    booking: booking._id, restaurant: restaurant._id, amount: 50, gatewayOrderId: `o_${booking._id}`,
  });
  return { booking, diner, restaurant, table };
}

describe('expireStaleHolds', () => {
  it('expires holds past their deadline and fails their payment', async () => {
    const now = new Date('2099-06-14T12:00:00Z');
    const { booking } = await pendingBooking(new Date('2099-06-14T11:00:00Z'));
    expect(await expireStaleHolds({}, now)).toBe(1);
    expect((await Booking.findById(booking._id)).status).toBe('expired');
    expect((await Payment.findOne({ booking: booking._id })).status).toBe('failed');
  });

  it('leaves live holds alone', async () => {
    const now = new Date('2099-06-14T12:00:00Z');
    const { booking } = await pendingBooking(new Date('2099-06-14T12:05:00Z'));
    expect(await expireStaleHolds({}, now)).toBe(0);
    expect((await Booking.findById(booking._id)).status).toBe('pending_payment');
  });

  it('frees the slot for another booking', async () => {
    const now = new Date('2099-06-14T12:00:00Z');
    const { booking, restaurant, table } = await pendingBooking(new Date('2099-06-14T11:00:00Z'));
    await expireStaleHolds({}, now);
    const other = await createUser('diner');
    await expect(
      createBookingDoc({ restaurant, table, diner: other, date: booking.date, slotStart: booking.slotStart }),
    ).resolves.toBeDefined();
  });
});

describe('releaseDinerHolds', () => {
  it("expires only that diner's pending hold for the slot", async () => {
    const { booking, diner, restaurant } = await pendingBooking(new Date('2099-06-16T00:00:00Z'));
    const released = await releaseDinerHolds({
      diner: diner._id, restaurant: restaurant._id, date: booking.date, slotStart: booking.slotStart,
    });
    expect(released).toBe(1);
    expect((await Booking.findById(booking._id)).status).toBe('expired');
    expect((await Payment.findOne({ booking: booking._id })).status).toBe('failed');
  });
});
