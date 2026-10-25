import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from '../constants.js';
import { Booking } from '../models/Booking.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { AppError } from '../utils/AppError.js';
import { generateSlots, slotInstant } from './slots.js';

const isLiveHold = (booking, now) =>
  booking.status !== BOOKING_STATUS.PENDING_PAYMENT || (booking.holdExpiresAt && booking.holdExpiresAt > now);

const blocksTable = (booking, now) => ACTIVE_BOOKING_STATUSES.includes(booking.status) && isLiveHold(booking, now);

export function computeAvailability({ restaurant, date, tables, bookings, partySize, now }) {
  const fitting = tables.filter((table) => table.isActive && table.seats >= partySize);
  return generateSlots(restaurant.openTime, restaurant.closeTime, restaurant.slotMinutes).map((slotStart) => {
    const taken = new Set(
      bookings.filter((b) => b.slotStart === slotStart && blocksTable(b, now)).map((b) => String(b.table)),
    );
    const isFuture = slotInstant(date, slotStart) > now;
    const hasFreeTable = fitting.some((table) => !taken.has(String(table._id)));
    return { slotStart, isAvailable: isFuture && hasFreeTable };
  });
}

export async function getAvailability({ restaurantId, date, partySize }, now = new Date()) {
  // A read never writes: computeAvailability already ignores expired holds, so there is nothing to clean up
  // first, and the three lookups are independent, so they run in one round trip.
  const [restaurant, tables, bookings] = await Promise.all([
    Restaurant.findById(restaurantId).lean(),
    Table.find({ restaurant: restaurantId }).lean(),
    Booking.find({ restaurant: restaurantId, date }).lean(),
  ]);
  if (!restaurant) throw new AppError(404, 'Restaurant not found');
  const slots = computeAvailability({ restaurant, date, tables, bookings, partySize, now });
  return { date, partySize, slots };
}
