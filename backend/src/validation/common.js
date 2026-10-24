import { z } from 'zod';
import { isValidDateString } from '../services/slots.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
export const dateString = z.string().refine(isValidDateString, 'Date must be a real YYYY-MM-DD date');
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');
