export const DEPOSIT_PER_PERSON_INR = 25;
export const HOLD_MINUTES = 10;
export const REFUND_CUTOFF_HOURS = 2;
export const TZ_OFFSET_MINUTES = 330;
export const MIN_SLOT_MINUTES = 30;
export const MAX_SLOT_MINUTES = 180;
export const MAX_PARTY_SIZE = 20;
export const BCRYPT_ROUNDS = 10;
export const HOLD_SWEEP_INTERVAL_MS = 60_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const PAISE_PER_RUPEE = 100;

export const ROLES = Object.freeze({ DINER: 'diner', OWNER: 'owner' });

export const BOOKING_STATUS = Object.freeze({
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  SEATED: 'seated',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  EXPIRED: 'expired',
});

export const ACTIVE_BOOKING_STATUSES = Object.freeze([
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.SEATED,
]);

export const PAYMENT_STATUS = Object.freeze({
  CREATED: 'created',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  FORFEITED: 'forfeited',
  REFUND_FAILED: 'refund_failed',
});
