import { z } from 'zod';
import { objectId } from './common.js';

export const verifyPaymentBody = z.object({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});

export const mockPayBody = z.object({ bookingId: objectId });
