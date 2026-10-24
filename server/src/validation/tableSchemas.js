import { z } from 'zod';

const MAX_SEATS = 50;

const base = z.object({
  label: z.string().trim().min(1).max(30),
  seats: z.number().int().min(1).max(MAX_SEATS),
  isActive: z.boolean(),
});

export const createTableBody = base.pick({ label: true, seats: true });

export const updateTableBody = base
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, { message: 'No fields to update' });
