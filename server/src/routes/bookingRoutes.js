import { Router } from 'express';
import { ROLES } from '../constants.js';
import { cancel, create, mine } from '../controllers/bookingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBookingBody } from '../validation/bookingSchemas.js';
import { idParam } from '../validation/common.js';

export const bookingRoutes = Router();
const dinerOnly = [requireAuth, requireRole(ROLES.DINER)];

bookingRoutes.post('/bookings', ...dinerOnly, validate({ body: createBookingBody }), create);
bookingRoutes.get('/bookings/mine', ...dinerOnly, mine);
bookingRoutes.patch('/bookings/:id/cancel', ...dinerOnly, validate({ params: idParam }), cancel);
