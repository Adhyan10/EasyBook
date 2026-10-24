import { z } from 'zod';

const MAX_PRICE_INR = 100000;

const base = z.object({
  category: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional(),
  price: z.number().int().min(1).max(MAX_PRICE_INR),
  isVeg: z.boolean().optional(),
});

export const createMenuItemBody = base;

export const updateMenuItemBody = base
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, { message: 'No fields to update' });
