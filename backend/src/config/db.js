import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}
