import { describe, expect, it } from 'vitest';
import { attachDeposits, withEffectiveStatus } from '../../src/services/bookingView.js';

const NOW = new Date('2099-06-15T10:00:00Z');
const booking = (id, status, holdExpiresAt) => ({ _id: id, status, holdExpiresAt });

describe('withEffectiveStatus', () => {
  it('shows a pending booking whose hold has ended as expired', () => {
    const [result] = withEffectiveStatus([booking('a', 'pending_payment', new Date('2099-06-15T09:00:00Z'))], NOW);
    expect(result.status).toBe('expired');
  });

  it('leaves live holds and every other status alone', () => {
    const list = [
      booking('a', 'pending_payment', new Date('2099-06-15T10:05:00Z')),
      booking('b', 'confirmed'),
      booking('c', 'cancelled'),
    ];
    expect(withEffectiveStatus(list, NOW).map((b) => b.status)).toEqual(['pending_payment', 'confirmed', 'cancelled']);
  });

  it('does not change the input objects', () => {
    const original = booking('a', 'pending_payment', new Date('2000-01-01'));
    withEffectiveStatus([original], NOW);
    expect(original.status).toBe('pending_payment');
  });
});

describe('attachDeposits', () => {
  it('joins payments to bookings by booking id and leaves others null', () => {
    const payments = [{ booking: 'a', amount: 50, status: 'paid', adjustedAt: null }];
    const result = attachDeposits([{ _id: 'a' }, { _id: 'b' }], payments);
    expect(result[0].deposit).toEqual({ amount: 50, status: 'paid', adjustedAt: null });
    expect(result[1].deposit).toBeNull();
  });
});
