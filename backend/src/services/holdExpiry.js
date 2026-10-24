import { BOOKING_STATUS, HOLD_SWEEP_INTERVAL_MS, PAYMENT_STATUS } from '../constants.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { logger } from '../utils/logger.js';

async function expireBookings(bookingIds) {
  await Booking.updateMany(
    { _id: { $in: bookingIds }, status: BOOKING_STATUS.PENDING_PAYMENT },
    { $set: { status: BOOKING_STATUS.EXPIRED }, $unset: { holdExpiresAt: 1 } },
  );
  await Payment.updateMany(
    { booking: { $in: bookingIds }, status: PAYMENT_STATUS.CREATED },
    { $set: { status: PAYMENT_STATUS.FAILED } },
  );
}

export async function expireStaleHolds(filter = {}, now = new Date()) {
  const stale = await Booking.find({
    ...filter,
    status: BOOKING_STATUS.PENDING_PAYMENT,
    holdExpiresAt: { $lt: now },
  })
    .select('_id')
    .lean();
  if (stale.length === 0) return 0;
  await expireBookings(stale.map((booking) => booking._id));
  return stale.length;
}

export async function releaseDinerHolds({ diner, restaurant, date, slotStart }) {
  const own = await Booking.find({ diner, restaurant, date, slotStart, status: BOOKING_STATUS.PENDING_PAYMENT })
    .select('_id')
    .lean();
  if (own.length === 0) return 0;
  await expireBookings(own.map((booking) => booking._id));
  return own.length;
}

export function startHoldExpiryJob(intervalMs = HOLD_SWEEP_INTERVAL_MS) {
  const timer = setInterval(() => {
    expireStaleHolds().catch((err) => logger.error('Hold expiry sweep failed', { err }));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
