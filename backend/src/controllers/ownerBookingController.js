import { PAYMENT_STATUS } from '../constants.js';
import { Payment } from '../models/Payment.js';
import { adjustDeposit, changeStatusAsOwner, retryRefundAsOwner } from '../services/bookingLifecycleService.js';
import { withEffectiveStatus } from '../services/bookingView.js';
import { dayBookingsWithDetails, ledgerRows } from '../services/ownerQueries.js';
import { summarizeDeposits } from '../services/depositSummary.js';
import { getOwnedRestaurant } from '../services/ownership.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

const LEDGER_STATUSES = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FORFEITED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.REFUND_FAILED,
];
const LEDGER_PAGE_SIZE = 100;

export const dayBookings = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const { date } = req.valid.query;
  // The ownership check and the data lookup run together; nothing is sent unless the check passes.
  const [, bookings] = await Promise.all([getOwnedRestaurant(id, req.user._id), dayBookingsWithDetails(id, date)]);
  sendOk(res, withEffectiveStatus(bookings));
});

export const changeStatus = asyncHandler(async (req, res) => {
  const result = await changeStatusAsOwner({
    bookingId: req.valid.params.id,
    ownerId: req.user._id,
    nextStatus: req.valid.body.status,
  });
  sendOk(res, result);
});

export const adjust = asyncHandler(async (req, res) => {
  const payment = await adjustDeposit({ bookingId: req.valid.params.id, ownerId: req.user._id });
  sendOk(res, { payment });
});

export const deposits = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  // Three independent lookups, one round trip: ownership, the totals over every row, and the newest rows.
  const [, allRows, items] = await Promise.all([
    getOwnedRestaurant(id, req.user._id),
    Payment.find({ restaurant: id, status: { $in: LEDGER_STATUSES } }, 'amount status adjustedAt').lean(),
    ledgerRows(id, LEDGER_STATUSES, LEDGER_PAGE_SIZE),
  ]);
  sendOk(res, { summary: summarizeDeposits(allRows), items });
});

export const retryRefund = asyncHandler(async (req, res) => {
  const deposit = await retryRefundAsOwner({ bookingId: req.valid.params.id, ownerId: req.user._id });
  sendOk(res, { deposit });
});
