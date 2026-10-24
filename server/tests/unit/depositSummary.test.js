import { describe, expect, it } from 'vitest';
import { summarizeDeposits } from '../../src/services/depositSummary.js';

describe('summarizeDeposits', () => {
  it('buckets payments by status and adjustment', () => {
    const payments = [
      { amount: 50, status: 'paid', adjustedAt: null },
      { amount: 25, status: 'paid', adjustedAt: new Date() },
      { amount: 75, status: 'paid', adjustedAt: new Date() },
      { amount: 100, status: 'forfeited' },
      { amount: 50, status: 'refunded' },
      { amount: 25, status: 'refund_failed' },
      { amount: 999, status: 'created' },
      { amount: 999, status: 'failed' },
    ];
    expect(summarizeDeposits(payments)).toEqual({
      pendingAdjustment: 50,
      adjusted: 100,
      forfeited: 100,
      refunded: 50,
      refundFailed: 25,
    });
  });

  it('returns zeros for no payments', () => {
    expect(summarizeDeposits([])).toEqual({
      pendingAdjustment: 0, adjusted: 0, forfeited: 0, refunded: 0, refundFailed: 0,
    });
  });
});
