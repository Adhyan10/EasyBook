import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { MIN_SEED_PASSWORD_LENGTH } from '../src/constants.js';
import { runSeed } from '../src/seed/runSeed.js';

const SNAPSHOT_URL = new URL('./data/bangalore-osm.json', import.meta.url);
const out = (text) => process.stdout.write(`${text}\n`);

async function loadElements() {
  try {
    const snapshot = JSON.parse(await readFile(SNAPSHOT_URL, 'utf8'));
    if (!Array.isArray(snapshot.elements)) throw new Error('missing "elements" array');
    return snapshot.elements;
  } catch (err) {
    throw new Error(`Cannot read scripts/data/bangalore-osm.json (${err.message}). Run "npm run seed:fetch" first.`);
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Create backend/.env first (see .env.example).');
  }
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (!ownerPassword || ownerPassword.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_OWNER_PASSWORD is required in backend/.env (at least ${MIN_SEED_PASSWORD_LENGTH} characters). Choose your own: the demo owner can cancel and no-show real bookings.`,
    );
  }
  const elements = await loadElements();
  await connectDb();
  const summary = await runSeed({
    elements,
    ownerPassword,
    resetOwnerPassword: process.argv.includes('--reset-owner-password'),
  });
  out(`Seed finished: ${JSON.stringify(summary)}`);
  out('Demo owner login: owner@demo.com');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`Seed failed: ${err.message}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
