import { describe, expect, it } from 'vitest';
import { DEPOSIT_DECISION, refundPolicy } from '../../src/services/refundPolicy.js';

const slotAt = new Date('2099-06-15T13:30:00Z');
const minutesBefore = (minutes) => new Date(slotAt.getTime() - minutes * 60_000);

describe('refundPolicy', () => {
  it('refunds a diner cancelling more than 2 hours ahead', () => {
    expect(refundPolicy({ slotAt, now: minutesBefore(121), cancelledBy: 'diner' })).toBe(DEPOSIT_DECISION.REFUND);
  });

  it('refunds a diner cancelling exactly 2 hours ahead', () => {
    expect(refundPolicy({ slotAt, now: minutesBefore(120), cancelledBy: 'diner' })).toBe(DEPOSIT_DECISION.REFUND);
  });

  it('forfeits when a diner cancels inside the 2 hour window', () => {
    expect(refundPolicy({ slotAt, now: minutesBefore(119), cancelledBy: 'diner' })).toBe(DEPOSIT_DECISION.FORFEIT);
  });

  it('always refunds when the owner cancels, even after the slot started', () => {
    expect(refundPolicy({ slotAt, now: minutesBefore(-30), cancelledBy: 'owner' })).toBe(DEPOSIT_DECISION.REFUND);
  });

  it('forfeits on no-show', () => {
    expect(refundPolicy({ slotAt, now: minutesBefore(-30), cancelledBy: 'no_show' })).toBe(DEPOSIT_DECISION.FORFEIT);
  });

  it('throws on an unknown actor', () => {
    expect(() => refundPolicy({ slotAt, now: slotAt, cancelledBy: 'robot' })).toThrowError(/Unknown cancelledBy/);
  });
});
