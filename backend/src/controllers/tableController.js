import { Table } from '../models/Table.js';
import { hasFutureActiveBookings } from '../services/bookingQueries.js';
import { getOwnedRestaurant } from '../services/ownership.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk } from '../utils/respond.js';

const MONGO_DUPLICATE_KEY = 11000;
const DUPLICATE_LABEL = 'A table with this label already exists';

async function getOwnedTable(tableId, userId) {
  const table = await Table.findById(tableId);
  if (!table) throw new AppError(404, 'Table not found');
  await getOwnedRestaurant(table.restaurant, userId);
  return table;
}

function rethrowDuplicateLabel(err) {
  if (err?.code === MONGO_DUPLICATE_KEY) throw new AppError(409, DUPLICATE_LABEL);
  throw err;
}

export const listTables = asyncHandler(async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.valid.params.id, req.user._id);
  sendOk(res, await Table.find({ restaurant: restaurant._id }).sort({ label: 1 }));
});

export const createTable = asyncHandler(async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.valid.params.id, req.user._id);
  const table = await Table.create({ ...req.valid.body, restaurant: restaurant._id }).catch(rethrowDuplicateLabel);
  sendOk(res, table, 201);
});

export const updateTable = asyncHandler(async (req, res) => {
  const table = await getOwnedTable(req.valid.params.id, req.user._id);
  const updated = await Table.findByIdAndUpdate(table._id, { $set: req.valid.body }, { new: true, runValidators: true })
    .catch(rethrowDuplicateLabel);
  sendOk(res, updated);
});

export const deleteTable = asyncHandler(async (req, res) => {
  const table = await getOwnedTable(req.valid.params.id, req.user._id);
  if (await hasFutureActiveBookings({ table: table._id })) {
    throw new AppError(409, 'This table has upcoming bookings. Deactivate it instead.');
  }
  await Table.deleteOne({ _id: table._id });
  sendOk(res, { deleted: true });
});
