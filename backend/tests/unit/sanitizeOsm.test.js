import { describe, expect, it } from 'vitest';
import { sanitizeElement } from '../../src/seed/sanitizeOsm.js';

describe('sanitizeElement', () => {
  it('keeps only name, cuisine and address tags', () => {
    const result = sanitizeElement({
      type: 'node',
      id: 7,
      center: { lat: 12.9, lon: 77.6 },
      tags: {
        name: 'Udupi Park',
        cuisine: 'south_indian',
        'addr:street': '4th Block',
        'addr:suburb': 'Jayanagar',
        'addr:neighborhood': 'Jayanagar East',
        phone: '+91 98765 43210',
        'contact:phone': '+91 98765 43211',
        'contact:whatsapp': '+91 98765 43212',
        email: 'owner@example.com',
        'contact:email': 'x@example.com',
        website: 'https://example.com',
        fax: '123',
        note: 'owner lives upstairs',
        'name:kn': 'ಉಡುಪಿ',
        opening_hours: 'Mo-Su 08:00-22:00',
      },
    });
    expect(result).toEqual({
      type: 'node',
      id: 7,
      tags: {
        name: 'Udupi Park',
        cuisine: 'south_indian',
        'addr:street': '4th Block',
        'addr:suburb': 'Jayanagar',
        'addr:neighborhood': 'Jayanagar East',
      },
    });
  });

  it('drops contact-like keys even under the addr: prefix', () => {
    const { tags } = sanitizeElement({
      type: 'way', id: 1, tags: { name: 'A', 'addr:phone': '123', 'addr:email': 'a@b.c', 'addr:city': 'Bengaluru' },
    });
    expect(tags).toEqual({ name: 'A', 'addr:city': 'Bengaluru' });
  });

  it('handles an element without tags', () => {
    expect(sanitizeElement({ type: 'node', id: 2 })).toEqual({ type: 'node', id: 2, tags: {} });
  });
});
