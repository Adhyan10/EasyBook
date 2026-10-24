import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, DEMO_OWNER_EMAIL, MIN_SEED_PASSWORD_LENGTH, ROLES } from '../constants.js';
import { MenuItem } from '../models/MenuItem.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { User } from '../models/User.js';
import { MENU_TEMPLATES } from './menuTemplates.js';
import { mapOsmElement } from './osmMapper.js';
import { tableLayoutFor } from './tableLayout.js';

export const SEED_LIMIT = 200;
const DEMO_OWNER_NAME = 'Demo Owner';

function assertStrongPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(`ownerPassword is required and must be at least ${MIN_SEED_PASSWORD_LENGTH} characters`);
  }
}

async function upsertDemoOwner(password, resetPassword) {
  const existing = await User.findOne({ email: DEMO_OWNER_EMAIL });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return User.create({ name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL, passwordHash, role: ROLES.OWNER });
  }
  if (existing.role !== ROLES.OWNER) {
    throw new Error(`${DEMO_OWNER_EMAIL} already exists but is not an owner account. Remove it and re-run.`);
  }
  if (resetPassword) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return User.findByIdAndUpdate(existing._id, { $set: { passwordHash } }, { new: true });
  }
  return existing;
}

function uniqueByExternalId(records) {
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.externalId)) return false;
    seen.add(record.externalId);
    return true;
  });
}

async function ensureTables(restaurant) {
  if ((await Table.countDocuments({ restaurant: restaurant._id })) > 0) return 0;
  const layout = tableLayoutFor(restaurant.externalId).map((table) => ({ ...table, restaurant: restaurant._id }));
  const created = await Table.insertMany(layout);
  return created.length;
}

async function ensureMenu(restaurant, cuisineKey) {
  if ((await MenuItem.countDocuments({ restaurant: restaurant._id })) > 0) return 0;
  const items = MENU_TEMPLATES[cuisineKey].map((item) => ({ ...item, restaurant: restaurant._id, isSample: true }));
  const created = await MenuItem.insertMany(items);
  return created.length;
}

export async function runSeed({ elements, ownerPassword, limit = SEED_LIMIT, resetOwnerPassword = false }) {
  assertStrongPassword(ownerPassword);
  const owner = await upsertDemoOwner(ownerPassword, resetOwnerPassword);
  const records = uniqueByExternalId(elements.map(mapOsmElement).filter(Boolean)).slice(0, limit);
  const summary = { restaurantsCreated: 0, restaurantsExisting: 0, tablesCreated: 0, menuItemsCreated: 0 };

  for (const { cuisineKey, ...fields } of records) {
    let restaurant = await Restaurant.findOne({ externalId: fields.externalId });
    if (restaurant) {
      summary.restaurantsExisting += 1;
    } else {
      restaurant = await Restaurant.create({ ...fields, owner: owner._id });
      summary.restaurantsCreated += 1;
    }
    summary.tablesCreated += await ensureTables(restaurant);
    summary.menuItemsCreated += await ensureMenu(restaurant, cuisineKey);
  }
  return summary;
}
