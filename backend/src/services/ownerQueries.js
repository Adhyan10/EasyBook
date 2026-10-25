import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// $lookup that returns the first matching document with only the listed fields, or null.
const joinOne = ({ from, localField, as, project }) => [
  { $lookup: { from, localField, foreignField: '_id', as, pipeline: [{ $project: project }] } },
  { $addFields: { [as]: { $ifNull: [{ $first: `$${as}` }, null] } } },
];

// A day's reservations with guest, table and deposit, fetched in ONE database round trip.
export function dayBookingsWithDetails(restaurantId, date) {
  return Booking.aggregate([
    { $match: { restaurant: toObjectId(restaurantId), date } },
    { $sort: { slotStart: 1 } },
    ...joinOne({ from: 'users', localField: 'diner', as: 'diner', project: { name: 1, email: 1 } }),
    ...joinOne({ from: 'tables', localField: 'table', as: 'table', project: { label: 1, seats: 1 } }),
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'booking',
        as: 'payment',
        pipeline: [{ $project: { amount: 1, status: 1, adjustedAt: 1 } }],
      },
    },
    {
      $addFields: {
        deposit: {
          $let: {
            vars: { p: { $first: '$payment' } },
            in: {
              $cond: [
                { $ifNull: ['$$p', false] },
                { amount: '$$p.amount', status: '$$p.status', adjustedAt: { $ifNull: ['$$p.adjustedAt', null] } },
                null,
              ],
            },
          },
        },
      },
    },
    { $project: { payment: 0, __v: 0 } },
  ]);
}

// The newest deposit rows with their booking and guest name, in ONE round trip.
export function ledgerRows(restaurantId, statuses, limit) {
  return Payment.aggregate([
    { $match: { restaurant: toObjectId(restaurantId), status: { $in: statuses } } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'booking',
        pipeline: [
          { $project: { date: 1, slotStart: 1, partySize: 1, status: 1, diner: 1 } },
          ...joinOne({ from: 'users', localField: 'diner', as: 'diner', project: { name: 1 } }),
        ],
      },
    },
    { $addFields: { booking: { $ifNull: [{ $first: '$booking' }, null] } } },
    { $project: { __v: 0 } },
  ]);
}
