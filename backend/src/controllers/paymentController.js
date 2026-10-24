import { getGateway } from '../gateway/index.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { confirmPayment } from '../services/paymentService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

const CAPTURED_EVENT = 'payment.captured';

function respondWithOutcome(res, { outcome, booking }) {
  const lostTheSlot = outcome === 'already_processed' && booking?.status === 'expired';
  if (outcome === 'refunded' || lostTheSlot) {
    throw new AppError(409, 'Your hold expired and the slot was taken. Your payment has been refunded.');
  }
  if (outcome === 'refund_failed') {
    throw new AppError(502, 'Your hold expired and the slot was taken, but the refund failed. Contact the restaurant.');
  }
  sendOk(res, { outcome, booking });
}

export const verify = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.valid.body;
  const payment = await Payment.findOne({ gatewayOrderId: orderId }).populate('booking', 'diner');
  if (!payment?.booking) throw new AppError(404, 'Unknown payment order');
  if (!payment.booking.diner.equals(req.user._id)) throw new AppError(403, 'This is not your booking');
  if (!getGateway().verifyPaymentSignature({ orderId, paymentId, signature })) {
    throw new AppError(400, 'Invalid payment signature');
  }
  respondWithOutcome(res, await confirmPayment({ orderId, paymentId }));
});

function parseWebhookEvent(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError(400, 'Malformed webhook body');
  }
}

export const webhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!Buffer.isBuffer(req.body) || !getGateway().verifyWebhookSignature(req.body, signature)) {
    throw new AppError(400, 'Invalid webhook signature');
  }
  const event = parseWebhookEvent(req.body);
  if (event.event !== CAPTURED_EVENT) return sendOk(res, { ignored: true });

  const entity = event.payload?.payment?.entity;
  if (!entity?.id || !entity?.order_id || !Number.isInteger(entity?.amount)) {
    throw new AppError(400, 'Malformed webhook payload');
  }
  const result = await confirmPayment({
    orderId: entity.order_id,
    paymentId: entity.id,
    paidAmountPaise: entity.amount,
  });
  return sendOk(res, { outcome: result.outcome }); // always 200 so the gateway stops retrying
});

export const mockPay = asyncHandler(async (req, res) => {
  const gateway = getGateway();
  if (gateway.name !== 'mock') throw new AppError(404, 'Route not found');
  const booking = await Booking.findOne({ _id: req.valid.body.bookingId, diner: req.user._id });
  const payment = booking && (await Payment.findOne({ booking: booking._id }));
  if (!payment) throw new AppError(404, 'Booking not found');
  sendOk(res, gateway.simulatePayment(payment.gatewayOrderId));
});
