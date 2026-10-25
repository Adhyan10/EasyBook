import mongoose from 'mongoose';
import { DEPOSIT_PER_PERSON_INR, MAX_SLOT_MINUTES, MIN_SLOT_MINUTES } from '../constants.js';

const restaurantSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    cuisine: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, maxlength: 60, default: '' },
    source: { type: String, enum: ['owner', 'osm'], default: 'owner' },
    externalId: { type: String, trim: true },
    isSample: { type: Boolean, default: false },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
    slotMinutes: { type: Number, required: true, min: MIN_SLOT_MINUTES, max: MAX_SLOT_MINUTES },
    depositPerPerson: { type: Number, default: DEPOSIT_PER_PERSON_INR, min: 0 },
  },
  { timestamps: true },
);

restaurantSchema.index({ city: 1, cuisine: 1 });
restaurantSchema.index({ name: 1 });
restaurantSchema.index({ owner: 1, name: 1 });
restaurantSchema.index({ externalId: 1 }, { unique: true, sparse: true });

export const Restaurant = mongoose.models.Restaurant ?? mongoose.model('Restaurant', restaurantSchema);
