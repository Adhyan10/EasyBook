import { getAvailability } from '../services/availability.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

export const availability = asyncHandler(async (req, res) => {
  const { date, partySize } = req.valid.query;
  sendOk(res, await getAvailability({ restaurantId: req.valid.params.id, date, partySize }));
});
