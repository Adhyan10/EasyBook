import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from '../../src/services/bookingStateMachine.js';

const VALID = [
  ['pending_payment', 'confirmed'],
  ['pending_payment', 'expired'],
  ['confirmed', 'seated'],
  ['confirmed', 'no_show'],
  ['confirmed', 'cancelled'],
  ['seated', 'completed'],
];

const INVALID = [
  ['pending_payment', 'seated'],
  ['pending_payment', 'cancelled'],
  ['confirmed', 'completed'],
  ['confirmed', 'expired'],
  ['seated', 'cancelled'],
  ['completed', 'seated'],
  ['cancelled', 'confirmed'],
  ['no_show', 'completed'],
  ['expired', 'confirmed'],
  ['unknown', 'confirmed'],
];

describe('bookingStateMachine', () => {
  it.each(VALID)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(INVALID)('rejects %s -> %s with a 409', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrowError(/Cannot change/);
    try {
      assertTransition(from, to);
    } catch (err) {
      expect(err.status).toBe(409);
    }
  });
});
