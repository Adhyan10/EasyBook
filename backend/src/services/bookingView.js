import { Payment } from '../models/Payment.js';

const toPlain = (booking) => (typeof booking.toJSON === 'function' ? booking.toJSON() : booking);

export async function withDeposits(bookings) {
  const payments = await Payment.find({ booking: { $in: bookings.map((b) => b._id) } }).lean();
  const byBooking = new Map(payments.map((payment) => [String(payment.booking), payment]));
  return bookings.map((booking) => {
    const payment = byBooking.get(String(booking._id));
    const deposit = payment
      ? { amount: payment.amount, status: payment.status, adjustedAt: payment.adjustedAt ?? null }
      : null;
    return { ...toPlain(booking), deposit };
  });
}
