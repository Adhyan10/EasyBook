import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { safeEqual, sign } from './signature.js';

export function createMockGateway({ secret = env.MOCK_GATEWAY_SECRET } = {}) {
  return {
    name: 'mock',
    publicKey: 'mock',

    async createOrder({ amountPaise }) {
      return { orderId: `order_mock_${crypto.randomUUID()}`, amount: amountPaise, currency: 'INR', keyId: 'mock' };
    },

    verifyPaymentSignature: ({ orderId, paymentId, signature }) =>
      Boolean(signature) && safeEqual(sign(secret, `${orderId}|${paymentId}`), signature),

    verifyWebhookSignature: (rawBody, signature) => Boolean(signature) && safeEqual(sign(secret, rawBody), signature),

    async refund({ paymentId }) {
      return { refundId: `rfnd_mock_${paymentId}` };
    },

    simulatePayment(orderId) {
      const paymentId = `pay_mock_${orderId}`;
      return { orderId, paymentId, signature: sign(secret, `${orderId}|${paymentId}`) };
    },
  };
}
