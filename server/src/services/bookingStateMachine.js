import { BOOKING_STATUS as S } from '../constants.js';
import { AppError } from '../utils/AppError.js';

// A late payment on an `expired` booking is a system action (see paymentService)
// and deliberately bypasses this table.
const TRANSITIONS = Object.freeze({
  [S.PENDING_PAYMENT]: [S.CONFIRMED, S.EXPIRED],
  [S.CONFIRMED]: [S.SEATED, S.NO_SHOW, S.CANCELLED],
  [S.SEATED]: [S.COMPLETED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
  [S.NO_SHOW]: [],
  [S.EXPIRED]: [],
});

export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new AppError(409, `Cannot change a ${from} booking to ${to}`);
  }
}
