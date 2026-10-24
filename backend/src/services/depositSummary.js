import { PAYMENT_STATUS } from '../constants.js';

const EMPTY = Object.freeze({ pendingAdjustment: 0, adjusted: 0, forfeited: 0, refunded: 0, refundFailed: 0 });

function bucketOf({ status, adjustedAt }) {
  if (status === PAYMENT_STATUS.PAID) return adjustedAt ? 'adjusted' : 'pendingAdjustment';
  if (status === PAYMENT_STATUS.FORFEITED) return 'forfeited';
  if (status === PAYMENT_STATUS.REFUNDED) return 'refunded';
  if (status === PAYMENT_STATUS.REFUND_FAILED) return 'refundFailed';
  return null;
}

export function summarizeDeposits(payments) {
  return payments.reduce((totals, payment) => {
    const bucket = bucketOf(payment);
    return bucket ? { ...totals, [bucket]: totals[bucket] + payment.amount } : totals;
  }, { ...EMPTY });
}
