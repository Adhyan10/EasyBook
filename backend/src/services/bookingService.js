import {
  BOOKING_STATUS,
  HOLD_MINUTES,
  MAX_LIVE_HOLDS_PER_DINER,
  MS_PER_MINUTE,
  PAISE_PER_RUPEE,
  PAYMENT_STATUS,
} from '../constants.js';
import { getGateway } from '../gateway/index.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { expireStaleHolds, releaseDinerHolds } from './holdExpiry.js';
import { isOnGrid, slotInstant } from './slots.js';

const MONGO_DUPLICATE_KEY = 11000;

function assertBookableSlot(restaurant, date, slotStart, now) {
  if (!isOnGrid(slotStart, restaurant)) throw new AppError(422, 'That time is not a bookable slot');
  if (slotInstant(date, slotStart) <= now) throw new AppError(422, 'That slot is in the past');
}

async function assertUnderHoldCap(dinerId, now) {
  const liveHolds = await Booking.countDocuments({
    diner: dinerId,
    status: BOOKING_STATUS.PENDING_PAYMENT,
    holdExpiresAt: { $gt: now },
  });
  if (liveHolds >= MAX_LIVE_HOLDS_PER_DINER) {
    throw new AppError(429, 'You have too many unpaid holds. Complete or wait out a pending payment first.');
  }
}

async function holdFirstFreeTable({ tables, restaurant, diner, date, slotStart, partySize, now }) {
  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * MS_PER_MINUTE);
  for (const table of tables) {
    try {
      const booking = await Booking.create({
        restaurant: restaurant._id,
        table: table._id,
        diner: diner._id,
        date,
        slotStart,
        partySize,
        status: BOOKING_STATUS.PENDING_PAYMENT,
        holdExpiresAt,
      });
      return { booking, table };
    } catch (err) {
      if (err?.code !== MONGO_DUPLICATE_KEY) throw err;
    }
  }
  throw new AppError(409, 'That slot was just taken. Please pick another time.');
}

async function openPaymentOrder({ booking, restaurant, partySize }) {
  const depositAmount = restaurant.depositPerPerson * partySize;
  const gateway = getGateway();
  try {
    const order = await gateway.createOrder({
      amountPaise: depositAmount * PAISE_PER_RUPEE,
      receipt: String(booking._id),
    });
    await Payment.create({
      booking: booking._id,
      restaurant: restaurant._id,
      amount: depositAmount,
      gatewayOrderId: order.orderId,
    });
    return { depositAmount, order: { ...order, gateway: gateway.name } };
  } catch (err) {
    await Booking.deleteOne({ _id: booking._id });
    logger.error('Could not open payment order', { bookingId: booking._id, err });
    throw new AppError(502, 'Payment service is unavailable. Please try again.');
  }
}

export async function getResumeOrder({ bookingId, userId }, now = new Date()) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, 'Booking not found');
  if (!booking.diner.equals(userId)) throw new AppError(403, 'This is not your booking');

  const holdIsLive =
    booking.status === BOOKING_STATUS.PENDING_PAYMENT && booking.holdExpiresAt && booking.holdExpiresAt > now;
  const payment = holdIsLive && (await Payment.findOne({ booking: booking._id, status: PAYMENT_STATUS.CREATED }));
  if (!payment) throw new AppError(409, 'This hold has expired or is already paid. Book the table again if needed.');

  const gateway = getGateway();
  const order = {
    orderId: payment.gatewayOrderId,
    amount: payment.amount * PAISE_PER_RUPEE,
    currency: 'INR',
    keyId: gateway.publicKey,
    gateway: gateway.name,
  };
  return { booking, order };
}

export async function createBooking({ diner, restaurantId, date, slotStart, partySize }, now = new Date()) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw new AppError(404, 'Restaurant not found');
  assertBookableSlot(restaurant, date, slotStart, now);

  await expireStaleHolds({ restaurant: restaurant._id, date }, now);
  await releaseDinerHolds({ diner: diner._id, restaurant: restaurant._id, date, slotStart });
  await assertUnderHoldCap(diner._id, now);

  const tables = await Table.find({
    restaurant: restaurant._id,
    isActive: true,
    seats: { $gte: partySize },
  }).sort({ seats: 1, label: 1 });
  if (tables.length === 0) throw new AppError(422, 'No table can seat a party this large');

  const { booking, table } = await holdFirstFreeTable({ tables, restaurant, diner, date, slotStart, partySize, now });
  const { order, depositAmount } = await openPaymentOrder({ booking, restaurant, partySize });
  return { booking, table: { _id: table._id, label: table.label, seats: table.seats }, order, depositAmount };
}
