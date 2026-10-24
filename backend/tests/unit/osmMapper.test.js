import { describe, expect, it } from 'vitest';
import { mapOsmElement } from '../../src/seed/osmMapper.js';

const element = (tags, extra = {}) => ({ type: 'node', id: 1, tags, ...extra });

describe('mapOsmElement', () => {
  it('maps a fully tagged element', () => {
    const result = mapOsmElement(
      element({
        name: 'Udupi Park', 'addr:suburb': 'Jayanagar', 'addr:housenumber': '12', 'addr:street': '4th Block',
        cuisine: 'south_indian',
      }),
    );
    expect(result).toEqual({
      externalId: 'node/1',
      name: 'Udupi Park',
      area: 'Jayanagar',
      address: '12 4th Block, Jayanagar',
      cuisine: 'South Indian',
      cuisineKey: 'south_indian',
      city: 'Bangalore',
      openTime: '11:00',
      closeTime: '23:00',
      slotMinutes: 60,
      source: 'osm',
      isSample: true,
    });
  });

  it.each([
    ['no tags', { type: 'node', id: 2 }],
    ['no name', element({ cuisine: 'indian' })],
    ['blank name', element({ name: '   ' })],
    ['missing id', { type: 'node', tags: { name: 'X' } }],
    ['missing type', { id: 3, tags: { name: 'X' } }],
  ])('returns null for %s', (_label, input) => {
    expect(mapOsmElement(input)).toBeNull();
  });

  it('falls back to neighbourhood, then to plain Bangalore', () => {
    expect(mapOsmElement(element({ name: 'A', 'addr:neighbourhood': 'HSR' })).area).toBe('HSR');
    const bare = mapOsmElement(element({ name: 'B' }));
    expect(bare).toMatchObject({ area: '', address: 'Bangalore', cuisine: 'Cuisine not listed', cuisineKey: 'multi' });
  });

  it('clips over-long values and keeps the element type in the id', () => {
    const result = mapOsmElement({ type: 'way', id: 9, tags: { name: 'N'.repeat(120) } });
    expect(result.name).toHaveLength(80);
    expect(result.externalId).toBe('way/9');
  });
});
