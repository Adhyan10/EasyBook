import { BOOKING_STATUS, PAISE_PER_RUPEE, PAYMENT_STATUS } from '../constants.js';
import { getGateway } from '../gateway/index.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { DEPOSIT_DECISION } from './refundPolicy.js';

const MONGO_DUPLICATE_KEY = 11000;
const REFUND_FAILED_MESSAGE = 'The refund could not be processed automatically. Please contact the restaurant.';

export async function settleDeposit(bookingId, decision) {
  const payment = await Payment.findOne({ booking: bookingId, status: PAYMENT_STATUS.PAID });
  if (!payment) return { status: 'none', amount: 0 };

  const transition = (status) => Payment.updateOne({ _id: payment._id, status: PAYMENT_STATUS.PAID }, { $set: { status } });

  if (decision === DEPOSIT_DECISION.FORFEIT) {
    await transition(PAYMENT_STATUS.FORFEITED);
    return { status: PAYMENT_STATUS.FORFEITED, amount: payment.amount };
  }

  try {
    await getGateway().refund({
      paymentId: payment.gatewayPaymentId,
      amountPaise: payment.amount * PAISE_PER_RUPEE,
    });
  } catch (err) {
    await transition(PAYMENT_STATUS.REFUND_FAILED);
    logger.error('Gateway refund failed', { bookingId, err });
    throw new AppError(502, REFUND_FAILED_MESSAGE);
  }
  await transition(PAYMENT_STATUS.REFUNDED);
  return { status: PAYMENT_STATUS.REFUNDED, amount: payment.amount };
}

async function confirmBooking(bookingId) {
  try {
    return await Booking.findOneAndUpdate(
      { _id: bookingId, status: { $in: [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.EXPIRED] } },
      { $set: { status: BOOKING_STATUS.CONFIRMED }, $unset: { holdExpiresAt: 1 } },
      { new: true },
    );
  } catch (err) {
    if (err?.code === MONGO_DUPLICATE_KEY) return null; // slot was rebooked while the hold was expired
    throw err;
  }
}

async function refundUnconfirmable(bookingId) {
  try {
    await settleDeposit(bookingId, DEPOSIT_DECISION.REFUND);
  } catch (err) {
    if (err instanceof AppError && err.status === 502) {
      return { outcome: 'refund_failed', booking: await Booking.findById(bookingId) };
    }
    throw err;
  }
  return { outcome: 'refunded', booking: await Booking.findById(bookingId) };
}

export async function confirmPayment({ orderId, paymentId, paidAmountPaise }) {
  const payment = await Payment.findOne({ gatewayOrderId: orderId });
  if (!payment) throw new AppError(404, 'Unknown payment order');

  if (paidAmountPaise !== undefined && paidAmountPaise !== payment.amount * PAISE_PER_RUPEE) {
    logger.error('Payment amount mismatch', { orderId, expected: payment.amount * PAISE_PER_RUPEE, paidAmountPaise });
    throw new AppError(400, 'Payment amount mismatch');
  }

  // Only one caller can claim the payment, so verify + webhook cannot double-process.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.FAILED] } },
    { $set: { status: PAYMENT_STATUS.PAID, gatewayPaymentId: paymentId } },
    { new: true },
  );
  if (!claimed) return { outcome: 'already_processed', booking: await Booking.findById(payment.booking) };

  const booking = await confirmBooking(payment.booking);
  if (booking) return { outcome: 'confirmed', booking };
  return refundUnconfirmable(payment.booking);
}
