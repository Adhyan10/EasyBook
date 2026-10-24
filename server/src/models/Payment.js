import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../constants.js';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    gatewayOrderId: { type: String, required: true, unique: true },
    gatewayPaymentId: { type: String },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.CREATED,
      required: true,
    },
    adjustedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ gatewayPaymentId: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
