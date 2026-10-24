import { describe, expect, it } from 'vitest';
import { MENU_TEMPLATES } from '../../src/seed/menuTemplates.js';

const KEYS = ['south_indian', 'north_indian', 'biryani', 'chinese', 'cafe', 'multi'];

describe('MENU_TEMPLATES', () => {
  it('defines the six template keys', () => {
    expect(Object.keys(MENU_TEMPLATES).sort()).toEqual([...KEYS].sort());
  });

  it.each(KEYS)('%s has 12 valid, unique items across at least 3 categories', (key) => {
    const items = MENU_TEMPLATES[key];
    expect(items).toHaveLength(12);
    expect(new Set(items.map((i) => i.category)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(items.map((i) => i.name)).size).toBe(12);
    items.forEach((i) => {
      expect(Number.isInteger(i.price)).toBe(true);
      expect(i.price).toBeGreaterThanOrEqual(20);
      expect(i.price).toBeLessThanOrEqual(900);
      expect(typeof i.isVeg).toBe('boolean');
      expect(i.name.length).toBeLessThanOrEqual(80);
      expect(i.category.length).toBeLessThanOrEqual(40);
    });
  });
});
