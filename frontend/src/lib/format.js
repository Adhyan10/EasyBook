const SECONDS_PER_MINUTE = 60;

export const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the browser's timezone
export const rupees = (amount) => `₹${amount}`;
export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const clock = (totalSeconds) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / SECONDS_PER_MINUTE))}:${pad(totalSeconds % SECONDS_PER_MINUTE)}`;
};

export const STATUS_LABEL = Object.freeze({
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  expired: 'Expired',
});

export const DEPOSIT_LABEL = Object.freeze({
  created: 'Not paid',
  paid: 'Paid',
  failed: 'Failed',
  refunding: 'Refunding',
  refunded: 'Refunded',
  forfeited: 'Forfeited',
  refund_failed: 'Refund failed',
});
