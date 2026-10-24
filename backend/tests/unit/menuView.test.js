import { describe, expect, it } from 'vitest';
import { groupMenu } from '../../src/services/menuView.js';

const item = (category, name, isSample = false) => ({ category, name, price: 100, isSample });

describe('groupMenu', () => {
  it('returns an empty, non-sample menu for no items', () => {
    expect(groupMenu([])).toEqual({ isSample: false, categories: [] });
  });

  it('groups by category in first-seen order and keeps item order', () => {
    const result = groupMenu([item('Starters', 'A'), item('Mains', 'B'), item('Starters', 'C')]);
    expect(result.categories.map((c) => c.name)).toEqual(['Starters', 'Mains']);
    expect(result.categories[0].items.map((i) => i.name)).toEqual(['A', 'C']);
    expect(result.categories[1].items.map((i) => i.name)).toEqual(['B']);
  });

  it('flags the menu as sample while any sample dish remains', () => {
    expect(groupMenu([item('A', 'x', true), item('A', 'y', true)]).isSample).toBe(true);
    expect(groupMenu([item('A', 'x', true), item('A', 'y', false)]).isSample).toBe(true);
    expect(groupMenu([item('A', 'x', false), item('A', 'y', false)]).isSample).toBe(false);
  });
});
