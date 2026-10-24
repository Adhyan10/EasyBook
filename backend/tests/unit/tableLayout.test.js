import { describe, expect, it } from 'vitest';
import { tableLayoutFor } from '../../src/seed/tableLayout.js';

const ids = Array.from({ length: 200 }, (_, i) => `node/${1000 + i * 7}`);

describe('tableLayoutFor', () => {
  it('is deterministic for the same id', () => {
    expect(tableLayoutFor('node/42')).toEqual(tableLayoutFor('node/42'));
  });

  it('always gives 4 to 6 sequentially labelled tables with valid sizes', () => {
    ids.forEach((id) => {
      const tables = tableLayoutFor(id);
      expect(tables.length).toBeGreaterThanOrEqual(4);
      expect(tables.length).toBeLessThanOrEqual(6);
      expect(tables.map((t) => t.label)).toEqual(tables.map((_, i) => `T${i + 1}`));
      tables.forEach((t) => expect([2, 4, 6, 8]).toContain(t.seats));
      expect(tables.some((t) => t.seats === 2)).toBe(true);
      expect(tables.some((t) => t.seats === 4)).toBe(true);
    });
  });

  it('varies across restaurants', () => {
    const shapes = new Set(ids.map((id) => tableLayoutFor(id).map((t) => t.seats).join(',')));
    expect(shapes.size).toBeGreaterThanOrEqual(2);
  });
});
