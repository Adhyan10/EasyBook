import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  // Keep a few connections open so the first requests after a start do not each pay a new TLS handshake.
  await mongoose.connect(env.MONGO_URI, { minPoolSize: 5, maxPoolSize: 20 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}
