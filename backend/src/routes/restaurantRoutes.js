import { Router } from 'express';
import { ROLES } from '../constants.js';
import { availability } from '../controllers/availabilityController.js';
import {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  myRestaurants,
  updateRestaurant,
} from '../controllers/restaurantController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validation/common.js';
import { availabilityQuery } from '../validation/bookingSchemas.js';
import { createRestaurantBody, listRestaurantsQuery, updateRestaurantBody } from '../validation/restaurantSchemas.js';

export const restaurantRoutes = Router();
const ownerOnly = [requireAuth, requireRole(ROLES.OWNER)];

restaurantRoutes.get('/restaurants', validate({ query: listRestaurantsQuery }), listRestaurants);
restaurantRoutes.get('/restaurants/mine', ...ownerOnly, validate({ query: listRestaurantsQuery }), myRestaurants);
restaurantRoutes.get('/restaurants/:id', validate({ params: idParam }), getRestaurant);
restaurantRoutes.get(
  '/restaurants/:id/availability',
  validate({ params: idParam, query: availabilityQuery }),
  availability,
);
restaurantRoutes.post('/restaurants', ...ownerOnly, validate({ body: createRestaurantBody }), createRestaurant);
restaurantRoutes.patch(
  '/restaurants/:id',
  ...ownerOnly,
  validate({ params: idParam, body: updateRestaurantBody }),
  updateRestaurant,
);
