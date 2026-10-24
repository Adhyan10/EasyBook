import { Restaurant } from '../models/Restaurant.js';
import { AppError } from '../utils/AppError.js';

export async function getOwnedRestaurant(restaurantId, userId) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw new AppError(404, 'Restaurant not found');
  if (!restaurant.owner.equals(userId)) throw new AppError(403, 'You do not own this restaurant');
  return restaurant;
}
