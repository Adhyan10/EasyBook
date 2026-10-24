import { z } from 'zod';
import { MAX_SLOT_MINUTES, MIN_SLOT_MINUTES } from '../constants.js';
import { toMinutes } from '../services/slots.js';
import { timeString } from './common.js';

const base = z.object({
  name: z.string().trim().min(2).max(80),
  cuisine: z.string().trim().min(2).max(40),
  city: z.string().trim().min(2).max(40),
  address: z.string().trim().min(3).max(160),
  description: z.string().trim().max(500).optional(),
  area: z.string().trim().max(60).optional(),
  openTime: timeString,
  closeTime: timeString,
  slotMinutes: z.number().int().min(MIN_SLOT_MINUTES).max(MAX_SLOT_MINUTES),
});

export const SCHEDULE_ERROR = 'closeTime must leave room for at least one slot after openTime';

export const hasRoomForSlot = ({ openTime, closeTime, slotMinutes }) =>
  toMinutes(closeTime) - toMinutes(openTime) >= slotMinutes;

export const createRestaurantBody = base.refine(hasRoomForSlot, { message: SCHEDULE_ERROR, path: ['closeTime'] });

export const updateRestaurantBody = base
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, { message: 'No fields to update' });

export const listRestaurantsQuery = z.object({
  city: z.string().trim().max(40).optional(),
  cuisine: z.string().trim().max(40).optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
