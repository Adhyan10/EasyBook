import { BOOKING_STATUS } from '../constants.js';
import { Booking } from '../models/Booking.js';
import { AppError } from '../utils/AppError.js';
import { assertTransition } from './bookingStateMachine.js';
import { settleDeposit } from './paymentService.js';
import { refundPolicy } from './refundPolicy.js';
import { slotInstant } from './slots.js';

async function loadBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
}

async function moveBooking(booking, nextStatus) {
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set: { status: nextStatus } },
    { new: true },
  );
  if (!updated) throw new AppError(409, 'This booking was just changed. Refresh and try again.');
  return updated;
}

export async function cancelBookingAsDiner({ bookingId, userId }, now = new Date()) {
  const booking = await loadBooking(bookingId);
  if (!booking.diner.equals(userId)) throw new AppError(403, 'This is not your booking');
  assertTransition(booking.status, BOOKING_STATUS.CANCELLED);

  const slotAt = slotInstant(booking.date, booking.slotStart);
  if (slotAt <= now) throw new AppError(422, 'This booking has already started');

  const updated = await moveBooking(booking, BOOKING_STATUS.CANCELLED);
  const deposit = await settleDeposit(booking._id, refundPolicy({ slotAt, now, cancelledBy: 'diner' }));
  return { booking: updated, deposit };
}
