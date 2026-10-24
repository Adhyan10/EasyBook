import { Router } from 'express';
import { ROLES } from '../constants.js';
import { mockPay, verify, webhook } from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { mockPayBody, verifyPaymentBody } from '../validation/paymentSchemas.js';

export const paymentRoutes = Router();
const dinerOnly = [requireAuth, requireRole(ROLES.DINER)];

paymentRoutes.post('/payments/verify', ...dinerOnly, validate({ body: verifyPaymentBody }), verify);
paymentRoutes.post('/payments/mock-pay', ...dinerOnly, validate({ body: mockPayBody }), mockPay);
paymentRoutes.post('/payments/webhook', webhook);
