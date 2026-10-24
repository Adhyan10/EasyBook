import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MenuItem } from '../../src/models/MenuItem.js';
import { Restaurant } from '../../src/models/Restaurant.js';
import { Table } from '../../src/models/Table.js';
import { User } from '../../src/models/User.js';
import { runSeed } from '../../src/seed/runSeed.js';
import { tableLayoutFor } from '../../src/seed/tableLayout.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';

const elements = JSON.parse(readFileSync(new URL('../fixtures/osm-sample.json', import.meta.url), 'utf8'));
const EXPECTED_TABLES = ['node/1', 'way/2', 'node/3'].reduce((sum, id) => sum + tableLayoutFor(id).length, 0);

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

describe('runSeed', () => {
  it('creates restaurants, tables and sample menus, skipping unnamed and duplicate elements', async () => {
    const summary = await runSeed({ elements });
    expect(summary).toEqual({
      restaurantsCreated: 3,
      restaurantsExisting: 0,
      tablesCreated: EXPECTED_TABLES,
      menuItemsCreated: 36,
    });

    const owner = await User.findOne({ email: 'owner@demo.com' });
    expect(owner.role).toBe('owner');
    const restaurants = await Restaurant.find();
    expect(restaurants).toHaveLength(3);
    restaurants.forEach((r) => {
      expect(r).toMatchObject({ source: 'osm', isSample: true, city: 'Bangalore' });
      expect(String(r.owner)).toBe(String(owner._id));
    });
    expect(await MenuItem.countDocuments({ isSample: false })).toBe(0);
    expect(await Table.countDocuments()).toBe(EXPECTED_TABLES);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await runSeed({ elements });
    const second = await runSeed({ elements });
    expect(second).toEqual({ restaurantsCreated: 0, restaurantsExisting: 3, tablesCreated: 0, menuItemsCreated: 0 });
    expect(await Restaurant.countDocuments()).toBe(3);
    expect(await Table.countDocuments()).toBe(EXPECTED_TABLES);
    expect(await MenuItem.countDocuments()).toBe(36);
    expect(await User.countDocuments({ email: 'owner@demo.com' })).toBe(1);
  });

  it('keeps owner-edited menus: edited items stay and deleted items do not return', async () => {
    await runSeed({ elements });
    const restaurant = await Restaurant.findOne({ externalId: 'node/1' });
    const [edited, removed] = await MenuItem.find({ restaurant: restaurant._id }).sort({ _id: 1 });
    await MenuItem.updateOne({ _id: edited._id }, { price: 777, isSample: false });
    await MenuItem.deleteOne({ _id: removed._id });

    await runSeed({ elements });

    expect(await MenuItem.countDocuments({ restaurant: restaurant._id })).toBe(11);
    expect((await MenuItem.findById(edited._id)).price).toBe(777);
    expect(await MenuItem.findById(removed._id)).toBeNull();
  });

  it('recreates tables only for a restaurant that has none', async () => {
    await runSeed({ elements });
    const restaurant = await Restaurant.findOne({ externalId: 'way/2' });
    await Table.deleteMany({ restaurant: restaurant._id });
    const second = await runSeed({ elements });
    expect(second.tablesCreated).toBe(tableLayoutFor('way/2').length);
  });

  it('respects the limit', async () => {
    const summary = await runSeed({ elements, limit: 2 });
    expect(summary.restaurantsCreated).toBe(2);
    expect(await Restaurant.countDocuments()).toBe(2);
  });

  it('handles an empty element list and still creates the demo owner', async () => {
    const summary = await runSeed({ elements: [] });
    expect(summary).toEqual({ restaurantsCreated: 0, restaurantsExisting: 0, tablesCreated: 0, menuItemsCreated: 0 });
    expect(await User.countDocuments({ email: 'owner@demo.com' })).toBe(1);
  });

  it('does not touch an existing demo owner', async () => {
    await User.create({ name: 'Existing', email: 'owner@demo.com', passwordHash: 'keep-me', role: 'owner' });
    await runSeed({ elements, ownerPassword: 'different' });
    expect((await User.findOne({ email: 'owner@demo.com' })).passwordHash).toBe('keep-me');
  });
});
