import { Booking } from '../models/Booking.js';
import { cancelBookingAsDiner } from '../services/bookingLifecycleService.js';
import { createBooking, getResumeOrder } from '../services/bookingService.js';
import { Payment } from '../models/Payment.js';
import { attachDeposits, withEffectiveStatus } from '../services/bookingView.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

export const create = asyncHandler(async (req, res) => {
  const result = await createBooking({ diner: req.user, ...req.valid.body });
  sendOk(res, result, 201);
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await cancelBookingAsDiner({ bookingId: req.valid.params.id, userId: req.user._id });
  sendOk(res, result);
});

export const mine = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ diner: req.user._id }).sort({ date: -1, slotStart: -1 }).lean();
  // The restaurant/table lookups and the deposits do not depend on each other: one round trip, not three.
  const [populated, payments] = await Promise.all([
    Booking.populate(bookings, [
      { path: 'restaurant', select: 'name city address' },
      { path: 'table', select: 'label' },
    ]),
    Payment.find({ booking: { $in: bookings.map((b) => b._id) } }).lean(),
  ]);
  sendOk(res, withEffectiveStatus(attachDeposits(populated, payments)));
});

export const resumeOrder = asyncHandler(async (req, res) => {
  sendOk(res, await getResumeOrder({ bookingId: req.valid.params.id, userId: req.user._id }));
});
