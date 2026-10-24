import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, ROLES } from '../constants.js';
import { MenuItem } from '../models/MenuItem.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { User } from '../models/User.js';
import { MENU_TEMPLATES } from './menuTemplates.js';
import { mapOsmElement } from './osmMapper.js';
import { tableLayoutFor } from './tableLayout.js';

export const SEED_LIMIT = 200;
export const DEMO_OWNER_EMAIL = 'owner@demo.com';
const DEMO_OWNER_NAME = 'Demo Owner';

async function upsertDemoOwner(password) {
  const existing = await User.findOne({ email: DEMO_OWNER_EMAIL });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return User.create({ name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL, passwordHash, role: ROLES.OWNER });
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

export async function runSeed({ elements, ownerPassword = 'password123', limit = SEED_LIMIT }) {
  const owner = await upsertDemoOwner(ownerPassword);
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
