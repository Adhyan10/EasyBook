import { createBooking } from '../services/bookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

export const create = asyncHandler(async (req, res) => {
  const result = await createBooking({ diner: req.user, ...req.valid.body });
  sendOk(res, result, 201);
});
