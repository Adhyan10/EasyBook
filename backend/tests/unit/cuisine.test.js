import { describe, expect, it } from 'vitest';
import { pickTemplate, titleCaseCuisine } from '../../src/seed/cuisine.js';

describe('pickTemplate', () => {
  it.each([
    ['south_indian', 'south_indian'],
    ['Udupi', 'south_indian'],
    ['biryani', 'biryani'],
    ['hyderabadi', 'biryani'],
    ['chinese;thai', 'chinese'],
    ['coffee_shop', 'cafe'],
    ['pizza', 'cafe'],
    ['punjabi', 'north_indian'],
    ['indian', 'north_indian'],
    ['regional', 'multi'],
    ['', 'multi'],
    [undefined, 'multi'],
  ])('maps %j to %s', (tag, expected) => {
    expect(pickTemplate(tag)).toBe(expected);
  });

  it('uses only the first value of a multi-value tag', () => {
    expect(pickTemplate('regional;chinese')).toBe('multi');
  });
});

describe('titleCaseCuisine', () => {
  it.each([
    ['south_indian', 'South Indian'],
    ['chinese;thai', 'Chinese'],
    ['', 'Cuisine not listed'],
    [undefined, 'Cuisine not listed'],
    ['  pizza ', 'Pizza'],
  ])('formats %j as %s', (tag, expected) => {
    expect(titleCaseCuisine(tag)).toBe(expected);
  });
});
