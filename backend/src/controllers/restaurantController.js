import { PUBLIC_CACHE_CONTROL } from '../constants.js';
import { Restaurant } from '../models/Restaurant.js';
import { hasFutureActiveBookings } from '../services/bookingQueries.js';
import { getOwnedRestaurant } from '../services/ownership.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/regex.js';
import { sendOk } from '../utils/respond.js';
import { hasRoomForSlot, SCHEDULE_ERROR } from '../validation/restaurantSchemas.js';

const SCHEDULE_FIELDS = ['openTime', 'closeTime', 'slotMinutes'];
const exactI = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

export const createRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.create({ ...req.valid.body, owner: req.user._id });
  sendOk(res, restaurant, 201);
});

function buildListFilter({ city, cuisine, q }, base = {}) {
  return {
    ...base,
    ...(city && { city: exactI(city) }),
    ...(cuisine && { cuisine: exactI(cuisine) }),
    ...(q && { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { area: new RegExp(escapeRegex(q), 'i') }] }),
  };
}

async function loadPage(filter, { page, limit }) {
  const [items, total] = await Promise.all([
    Restaurant.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Restaurant.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export const listRestaurants = asyncHandler(async (req, res) => {
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  sendOk(res, await loadPage(buildListFilter(req.valid.query), req.valid.query));
});

// Paged and searchable: an owner with many restaurants must not download all of them at once.
export const myRestaurants = asyncHandler(async (req, res) => {
  const filter = buildListFilter(req.valid.query, { owner: req.user._id });
  sendOk(res, await loadPage(filter, req.valid.query));
});

export const getRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.valid.params.id).lean();
  if (!restaurant) throw new AppError(404, 'Restaurant not found');
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  sendOk(res, restaurant);
});

export const updateRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.valid.params.id, req.user._id);
  const changes = req.valid.body;

  if (!hasRoomForSlot({ ...restaurant.toObject(), ...changes })) {
    throw new AppError(400, SCHEDULE_ERROR);
  }

  const touchesSchedule = SCHEDULE_FIELDS.some((field) => field in changes && changes[field] !== restaurant[field]);
  if (touchesSchedule && (await hasFutureActiveBookings({ restaurant: restaurant._id }))) {
    throw new AppError(409, 'Cannot change opening hours or slot length while upcoming bookings exist');
  }

  const updated = await Restaurant.findByIdAndUpdate(restaurant._id, { $set: changes }, { new: true, runValidators: true });
  sendOk(res, updated);
});
