import { PUBLIC_CACHE_CONTROL } from '../constants.js';
import { MenuItem } from '../models/MenuItem.js';
import { Restaurant } from '../models/Restaurant.js';
import { groupMenu } from '../services/menuView.js';
import { getOwnedRestaurant } from '../services/ownership.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

async function getOwnedItem(itemId, userId) {
  const item = await MenuItem.findById(itemId);
  if (!item) throw new AppError(404, 'Menu item not found');
  await getOwnedRestaurant(item.restaurant, userId);
  return item;
}

export const getMenu = asyncHandler(async (req, res) => {
  const restaurantId = req.valid.params.id;
  // One round trip, not two: the existence check and the items query do not depend on each other.
  const [exists, items] = await Promise.all([
    Restaurant.exists({ _id: restaurantId }),
    MenuItem.find({ restaurant: restaurantId }).sort({ createdAt: 1, _id: 1 }).lean(),
  ]);
  if (!exists) throw new AppError(404, 'Restaurant not found');
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  sendOk(res, groupMenu(items));
});

export const addItem = asyncHandler(async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.valid.params.id, req.user._id);
  const item = await MenuItem.create({ ...req.valid.body, restaurant: restaurant._id });
  sendOk(res, item, 201);
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await getOwnedItem(req.valid.params.id, req.user._id);
  const updated = await MenuItem.findByIdAndUpdate(
    item._id,
    { $set: { ...req.valid.body, isSample: false } },
    { new: true, runValidators: true },
  );
  sendOk(res, updated);
});

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await getOwnedItem(req.valid.params.id, req.user._id);
  await MenuItem.deleteOne({ _id: item._id });
  sendOk(res, { deleted: true });
});
