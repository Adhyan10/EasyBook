import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    label: { type: String, required: true, trim: true },
    seats: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'seats must be an integer' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

tableSchema.index({ restaurant: 1, label: 1 }, { unique: true });

export const Table = mongoose.models.Table ?? mongoose.model('Table', tableSchema);
