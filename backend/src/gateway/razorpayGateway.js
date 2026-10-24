import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { safeEqual, sign } from './signature.js';

const RECEIPT_MAX_LENGTH = 40;

export function createRazorpayGateway() {
  const client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });

  return {
    name: 'razorpay',

    async createOrder({ amountPaise, receipt }) {
      const order = await client.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: String(receipt).slice(0, RECEIPT_MAX_LENGTH),
      });
      return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID };
    },

    verifyPaymentSignature: ({ orderId, paymentId, signature }) =>
      Boolean(signature) && safeEqual(sign(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature),

    verifyWebhookSignature: (rawBody, signature) =>
      Boolean(signature) && safeEqual(sign(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature),

    async refund({ paymentId, amountPaise }) {
      const refund = await client.payments.refund(paymentId, { amount: amountPaise });
      return { refundId: refund.id };
    },
  };
}
