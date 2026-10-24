import mongoose from 'mongoose';

const MAX_PRICE_INR = 100000;

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    category: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    price: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_PRICE_INR,
      validate: { validator: Number.isInteger, message: 'price must be a whole number of rupees' },
    },
    isVeg: { type: Boolean, default: true },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

menuItemSchema.index({ restaurant: 1, category: 1 });

export const MenuItem = mongoose.models.MenuItem ?? mongoose.model('MenuItem', menuItemSchema);
