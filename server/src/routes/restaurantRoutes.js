import { Router } from 'express';
import { ROLES } from '../constants.js';
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
import { createRestaurantBody, listRestaurantsQuery, updateRestaurantBody } from '../validation/restaurantSchemas.js';

export const restaurantRoutes = Router();
const ownerOnly = [requireAuth, requireRole(ROLES.OWNER)];

restaurantRoutes.get('/restaurants', validate({ query: listRestaurantsQuery }), listRestaurants);
restaurantRoutes.get('/restaurants/mine', ...ownerOnly, myRestaurants);
restaurantRoutes.get('/restaurants/:id', validate({ params: idParam }), getRestaurant);
restaurantRoutes.post('/restaurants', ...ownerOnly, validate({ body: createRestaurantBody }), createRestaurant);
restaurantRoutes.patch(
  '/restaurants/:id',
  ...ownerOnly,
  validate({ params: idParam, body: updateRestaurantBody }),
  updateRestaurant,
);
