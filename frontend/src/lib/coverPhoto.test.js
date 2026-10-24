import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickCover } from './coverPhoto.js';

const photos = {
  pools: {
    south: [{ file: 'south-1.jpg' }, { file: 'south-2.jpg' }, { file: 'south-3.jpg' }],
    north: [{ file: 'north-1.jpg' }, { file: 'north-2.jpg' }],
    biryani: [{ file: 'biryani-1.jpg' }, { file: 'biryani-2.jpg' }],
    chinese: [{ file: 'chinese-1.jpg' }, { file: 'chinese-2.jpg' }],
    cafe: [{ file: 'cafe-1.jpg' }, { file: 'cafe-2.jpg' }],
    interior: [{ file: 'interior-1.jpg' }, { file: 'interior-2.jpg' }],
  },
};
const ids = Array.from({ length: 1000 }, (_, i) => `64b7f0c2a1b2c3d4e5f6${String(i).padStart(4, '0')}`);
const restaurant = (id, cuisine) => ({ _id: id, cuisine });
const kindOf = (pick) => (pick.file.startsWith('interior') ? 'interior' : 'food');

describe('pickCover', () => {
  it('gives the same photo to the same restaurant every time', () => {
    const r = restaurant(ids[7], 'Indian');
    assert.deepEqual(pickCover(photos, r), pickCover(photos, r));
  });

  it('mixes restaurant interiors and food photos, about three in ten interiors', () => {
    const picks = ids.map((id) => pickCover(photos, restaurant(id, 'Indian')));
    const interiors = picks.filter((p) => kindOf(p) === 'interior').length / ids.length;
    assert.ok(interiors > 0.2 && interiors < 0.4, `interior share was ${interiors}`);
  });

  it('matches food photos to the cuisine', () => {
    const cases = [
      ['South Indian', 'south-'], ['Udupi', 'south-'], ['Biryani', 'biryani-'], ['Chinese', 'chinese-'],
      ['Thai', 'chinese-'], ['Cafe', 'cafe-'], ['Pizza', 'cafe-'], ['Punjabi', 'north-'],
    ];
    for (const [cuisine, prefix] of cases) {
      const foods = ids.map((id) => pickCover(photos, restaurant(id, cuisine))).filter((p) => kindOf(p) === 'food');
      assert.ok(foods.length > 0);
      assert.ok(foods.every((p) => p.file.startsWith(prefix)), `${cuisine} got a non-${prefix} photo`);
    }
  });

  it('uses any food photo when the cuisine is unknown, and still returns a photo', () => {
    const foods = ids
      .map((id) => pickCover(photos, restaurant(id, 'Cuisine not listed')))
      .filter((p) => kindOf(p) === 'food');
    const families = new Set(foods.map((p) => p.file.split('-')[0]));
    assert.ok(families.size >= 4, `only saw ${[...families]}`);
  });

  it('uses every photo in a pool across many restaurants', () => {
    const seen = new Set(ids.map((id) => pickCover(photos, restaurant(id, 'South Indian')).file));
    assert.ok(seen.has('south-1.jpg') && seen.has('south-2.jpg') && seen.has('south-3.jpg') && seen.has('interior-1.jpg'));
  });

  it('returns null when there are no photos', () => {
    assert.equal(pickCover({ pools: {} }, restaurant(ids[0], 'Indian')), null);
  });

  it('tolerates a missing cuisine or id', () => {
    assert.ok(pickCover(photos, { _id: ids[1] }));
    assert.ok(pickCover(photos, { cuisine: 'Indian' }) !== undefined);
  });
});
