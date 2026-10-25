import { BOOKING_STATUS } from '../constants.js';
import { Payment } from '../models/Payment.js';

const toPlain = (booking) => (typeof booking.toJSON === 'function' ? booking.toJSON() : booking);

export function attachDeposits(bookings, payments) {
  const byBooking = new Map(payments.map((payment) => [String(payment.booking), payment]));
  return bookings.map((booking) => {
    const payment = byBooking.get(String(booking._id));
    const deposit = payment
      ? { amount: payment.amount, status: payment.status, adjustedAt: payment.adjustedAt ?? null }
      : null;
    return { ...toPlain(booking), deposit };
  });
}

export async function withDeposits(bookings) {
  const payments = await Payment.find({ booking: { $in: bookings.map((b) => b._id) } }).lean();
  return attachDeposits(bookings, payments);
}

// Listing bookings must not write. A pending booking whose hold has ended is shown as expired; the
// stored status is tidied up the next time someone books that slot or the background sweep runs.
export function withEffectiveStatus(bookings, now = new Date()) {
  return bookings.map((booking) =>
    booking.status === BOOKING_STATUS.PENDING_PAYMENT && booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= now
      ? { ...booking, status: BOOKING_STATUS.EXPIRED }
      : booking,
  );
}
