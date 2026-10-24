import { BOOKING_STATUS, PAYMENT_STATUS } from '../constants.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { AppError } from '../utils/AppError.js';
import { assertTransition } from './bookingStateMachine.js';
import { getOwnedRestaurant } from './ownership.js';
import { retryFailedRefund, settleDeposit } from './paymentService.js';
import { refundPolicy } from './refundPolicy.js';
import { slotInstant } from './slots.js';

const OWNER_CANCELLED_BY = Object.freeze({
  [BOOKING_STATUS.CANCELLED]: 'owner',
  [BOOKING_STATUS.NO_SHOW]: 'no_show',
});

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

export async function changeStatusAsOwner({ bookingId, ownerId, nextStatus }, now = new Date()) {
  const booking = await loadBooking(bookingId);
  await getOwnedRestaurant(booking.restaurant, ownerId);
  assertTransition(booking.status, nextStatus);

  const slotAt = slotInstant(booking.date, booking.slotStart);
  if (nextStatus === BOOKING_STATUS.NO_SHOW && slotAt > now) {
    throw new AppError(422, 'The slot has not started yet');
  }

  const updated = await moveBooking(booking, nextStatus);
  const actor = OWNER_CANCELLED_BY[nextStatus];
  const deposit = actor ? await settleDeposit(booking._id, refundPolicy({ slotAt, now, cancelledBy: actor })) : null;
  return { booking: updated, deposit };
}

export async function adjustDeposit({ bookingId, ownerId }, now = new Date()) {
  const booking = await loadBooking(bookingId);
  await getOwnedRestaurant(booking.restaurant, ownerId);
  if (![BOOKING_STATUS.SEATED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
    throw new AppError(409, 'Only seated or completed bookings can be adjusted');
  }
  const payment = await Payment.findOneAndUpdate(
    { booking: booking._id, status: PAYMENT_STATUS.PAID, adjustedAt: null },
    { $set: { adjustedAt: now } },
    { new: true },
  );
  if (!payment) throw new AppError(409, 'This deposit is not available to adjust');
  return payment;
}

export async function retryRefundAsOwner({ bookingId, ownerId }) {
  const booking = await loadBooking(bookingId);
  await getOwnedRestaurant(booking.restaurant, ownerId);
  return retryFailedRefund(booking._id);
}
