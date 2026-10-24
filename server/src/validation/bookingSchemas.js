import { z } from 'zod';
import { MAX_PARTY_SIZE } from '../constants.js';
import { dateString, objectId, timeString } from './common.js';

export const availabilityQuery = z.object({
  date: dateString,
  partySize: z.coerce.number().int().min(1).max(MAX_PARTY_SIZE),
});

export const createBookingBody = z.object({
  restaurantId: objectId,
  date: dateString,
  slotStart: timeString,
  partySize: z.number().int().min(1).max(MAX_PARTY_SIZE),
});
