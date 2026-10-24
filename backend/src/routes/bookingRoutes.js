import { Router } from 'express';
import { ROLES } from '../constants.js';
import { cancel, create, mine } from '../controllers/bookingController.js';
import { adjust, changeStatus, dayBookings, deposits } from '../controllers/ownerBookingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBookingBody, dayQuery, ownerStatusBody } from '../validation/bookingSchemas.js';
import { idParam } from '../validation/common.js';

export const bookingRoutes = Router();
const dinerOnly = [requireAuth, requireRole(ROLES.DINER)];
const ownerOnly = [requireAuth, requireRole(ROLES.OWNER)];

bookingRoutes.post('/bookings', ...dinerOnly, validate({ body: createBookingBody }), create);
bookingRoutes.get('/bookings/mine', ...dinerOnly, mine);
bookingRoutes.patch('/bookings/:id/cancel', ...dinerOnly, validate({ params: idParam }), cancel);

bookingRoutes.get('/restaurants/:id/bookings', ...ownerOnly, validate({ params: idParam, query: dayQuery }), dayBookings);
bookingRoutes.get('/restaurants/:id/deposits', ...ownerOnly, validate({ params: idParam }), deposits);
bookingRoutes.patch('/bookings/:id/status', ...ownerOnly, validate({ params: idParam, body: ownerStatusBody }), changeStatus);
bookingRoutes.patch('/bookings/:id/adjust', ...ownerOnly, validate({ params: idParam }), adjust);
