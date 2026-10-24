import { describe, expect, it } from 'vitest';
import {
  generateSlots,
  isOnGrid,
  isValidDateString,
  localDateString,
  slotInstant,
  toHHmm,
  toMinutes,
} from '../../src/services/slots.js';

describe('time helpers', () => {
  it('converts between HH:mm and minutes', () => {
    expect(toMinutes('13:30')).toBe(810);
    expect(toHHmm(810)).toBe('13:30');
    expect(toHHmm(5)).toBe('00:05');
  });
});

describe('generateSlots', () => {
  it('builds a grid from open time in slot steps', () => {
    expect(generateSlots('12:00', '15:00', 60)).toEqual(['12:00', '13:00', '14:00']);
  });

  it('drops a final slot that would run past closing time', () => {
    expect(generateSlots('12:00', '15:00', 90)).toEqual(['12:00', '13:30']);
  });

  it('returns an empty list when no slot fits', () => {
    expect(generateSlots('12:00', '12:30', 60)).toEqual([]);
  });
});

describe('isOnGrid', () => {
  const restaurant = { openTime: '12:00', closeTime: '23:00', slotMinutes: 60 };

  it('accepts grid starts including the last slot', () => {
    expect(isOnGrid('12:00', restaurant)).toBe(true);
    expect(isOnGrid('22:00', restaurant)).toBe(true);
  });

  it('rejects off-grid times and the closing time itself', () => {
    expect(isOnGrid('12:30', restaurant)).toBe(false);
    expect(isOnGrid('23:00', restaurant)).toBe(false);
    expect(isOnGrid('11:00', restaurant)).toBe(false);
  });
});

describe('slotInstant and localDateString', () => {
  it('converts an IST slot to the UTC instant', () => {
    expect(slotInstant('2026-10-26', '20:00').toISOString()).toBe('2026-10-26T14:30:00.000Z');
  });

  it('rolls the local date forward after 18:30 UTC', () => {
    expect(localDateString(new Date('2026-10-25T20:00:00Z'))).toBe('2026-10-26');
    expect(localDateString(new Date('2026-10-25T10:00:00Z'))).toBe('2026-10-25');
  });
});

describe('isValidDateString', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDateString('2026-10-26')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('26-10-2026')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });
});
