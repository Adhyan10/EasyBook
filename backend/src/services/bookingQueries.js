import { ACTIVE_BOOKING_STATUSES } from '../constants.js';
import { Booking } from '../models/Booking.js';
import { localDateString, slotInstant } from './slots.js';

export async function hasFutureActiveBookings(filter, now = new Date()) {
  const candidates = await Booking.find({
    ...filter,
    status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    date: { $gte: localDateString(now) },
  })
    .select('date slotStart')
    .lean();
  return candidates.some((booking) => slotInstant(booking.date, booking.slotStart) > now);
}
