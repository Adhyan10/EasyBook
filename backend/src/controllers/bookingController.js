import { Booking } from '../models/Booking.js';
import { cancelBookingAsDiner } from '../services/bookingLifecycleService.js';
import { createBooking, getResumeOrder } from '../services/bookingService.js';
import { withDeposits } from '../services/bookingView.js';
import { expireStaleHolds } from '../services/holdExpiry.js';
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
  await expireStaleHolds({ diner: req.user._id });
  const bookings = await Booking.find({ diner: req.user._id })
    .populate('restaurant', 'name city address')
    .populate('table', 'label')
    .sort({ date: -1, slotStart: -1 });
  sendOk(res, await withDeposits(bookings));
});

export const resumeOrder = asyncHandler(async (req, res) => {
  sendOk(res, await getResumeOrder({ bookingId: req.valid.params.id, userId: req.user._id }));
});
