import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { hasFutureActiveBookings } from '../../src/services/bookingQueries.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';

const oid = () => new mongoose.Types.ObjectId();
const base = () => ({
  restaurant: oid(),
  table: oid(),
  diner: oid(),
  date: '2099-06-15',
  slotStart: '19:00',
  partySize: 2,
});

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('Booking double-booking index', () => {
  it('rejects a second active booking for the same table, date and slot', async () => {
    const first = base();
    await Booking.create({ ...first, status: 'confirmed' });
    await expect(Booking.create({ ...first, diner: oid(), status: 'pending_payment' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('allows the slot again once the earlier booking is cancelled', async () => {
    const first = base();
    await Booking.create({ ...first, status: 'cancelled' });
    await expect(Booking.create({ ...first, diner: oid(), status: 'confirmed' })).resolves.toBeDefined();
  });

  it('allows the same slot on a different table', async () => {
    const first = base();
    await Booking.create({ ...first, status: 'confirmed' });
    await expect(Booking.create({ ...first, table: oid(), status: 'confirmed' })).resolves.toBeDefined();
  });

  it('rejects an invalid party size', async () => {
    await expect(Booking.create({ ...base(), partySize: 0 })).rejects.toThrow();
    await expect(Booking.create({ ...base(), partySize: 1.5 })).rejects.toThrow();
  });
});

describe('Payment uniqueness', () => {
  it('allows only one payment per booking', async () => {
    const bookingId = oid();
    const make = (orderId) => ({
      booking: bookingId,
      restaurant: oid(),
      amount: 50,
      gatewayOrderId: orderId,
    });
    await Payment.create(make('order_1'));
    await expect(Payment.create(make('order_2'))).rejects.toMatchObject({ code: 11000 });
  });
});

describe('hasFutureActiveBookings', () => {
  it('is true for an upcoming active booking', async () => {
    const data = base();
    await Booking.create({ ...data, status: 'confirmed' });
    expect(await hasFutureActiveBookings({ restaurant: data.restaurant })).toBe(true);
  });

  it('ignores cancelled and past bookings', async () => {
    const data = base();
    await Booking.create({ ...data, status: 'cancelled' });
    await Booking.create({ ...data, date: '2000-01-01', status: 'confirmed' });
    expect(await hasFutureActiveBookings({ restaurant: data.restaurant })).toBe(false);
  });
});
