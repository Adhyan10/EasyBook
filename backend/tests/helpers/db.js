import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;

export async function connectTestDb() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: 'easybook-test' });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function closeTestDb() {
  await mongoose.disconnect();
  await server?.stop();
}
