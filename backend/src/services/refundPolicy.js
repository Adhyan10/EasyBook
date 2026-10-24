import { MS_PER_HOUR, REFUND_CUTOFF_HOURS } from '../constants.js';

export const DEPOSIT_DECISION = Object.freeze({ REFUND: 'refund', FORFEIT: 'forfeit' });

export function refundPolicy({ slotAt, now, cancelledBy, cutoffHours = REFUND_CUTOFF_HOURS }) {
  if (cancelledBy === 'owner') return DEPOSIT_DECISION.REFUND;
  if (cancelledBy === 'no_show') return DEPOSIT_DECISION.FORFEIT;
  if (cancelledBy === 'diner') {
    const msBeforeSlot = slotAt.getTime() - now.getTime();
    return msBeforeSlot >= cutoffHours * MS_PER_HOUR ? DEPOSIT_DECISION.REFUND : DEPOSIT_DECISION.FORFEIT;
  }
  throw new Error(`Unknown cancelledBy: ${cancelledBy}`);
}
