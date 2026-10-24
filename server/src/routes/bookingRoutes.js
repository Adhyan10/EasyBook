import { Router } from 'express';
import { ROLES } from '../constants.js';
import { create } from '../controllers/bookingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBookingBody } from '../validation/bookingSchemas.js';

export const bookingRoutes = Router();
const dinerOnly = [requireAuth, requireRole(ROLES.DINER)];

bookingRoutes.post('/bookings', ...dinerOnly, validate({ body: createBookingBody }), create);
