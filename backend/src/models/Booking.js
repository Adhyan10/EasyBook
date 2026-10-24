import mongoose from 'mongoose';
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from '../constants.js';

const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: Schema.Types.ObjectId, ref: 'Table', required: true },
    diner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    slotStart: { type: String, required: true },
    partySize: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'partySize must be an integer' },
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING_PAYMENT,
      required: true,
    },
    holdExpiresAt: { type: Date },
  },
  { timestamps: true },
);

bookingSchema.index(
  { table: 1, date: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [...ACTIVE_BOOKING_STATUSES] } } },
);
bookingSchema.index({ restaurant: 1, date: 1 });
bookingSchema.index({ diner: 1, date: -1 });

export const Booking = mongoose.models.Booking ?? mongoose.model('Booking', bookingSchema);
