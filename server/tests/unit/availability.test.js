import { describe, expect, it } from 'vitest';
import { computeAvailability } from '../../src/services/availability.js';

const restaurant = { openTime: '12:00', closeTime: '15:00', slotMinutes: 60 };
const date = '2099-06-15';
const now = new Date('2099-06-14T00:00:00Z');
const tables = [
  { _id: 't4', seats: 4, isActive: true },
  { _id: 't2', seats: 2, isActive: true },
];
const booking = (table, slotStart, extra = {}) => ({ table, slotStart, status: 'confirmed', ...extra });
const run = (overrides = {}) =>
  computeAvailability({ restaurant, date, tables, bookings: [], partySize: 2, now, ...overrides });
const availability = (result) => Object.fromEntries(result.map((s) => [s.slotStart, s.isAvailable]));

describe('computeAvailability', () => {
  it('marks every slot available when nothing is booked', () => {
    expect(availability(run())).toEqual({ '12:00': true, '13:00': true, '14:00': true });
  });

  it('stays available while at least one fitting table is free', () => {
    const result = run({ bookings: [booking('t2', '12:00')] });
    expect(availability(result)['12:00']).toBe(true);
  });

  it('is unavailable when every fitting table is taken', () => {
    const result = run({ bookings: [booking('t2', '12:00'), booking('t4', '12:00')] });
    expect(availability(result)['12:00']).toBe(false);
  });

  it('only counts tables that fit the party', () => {
    const result = run({ partySize: 4, bookings: [booking('t4', '13:00')] });
    expect(availability(result)['13:00']).toBe(false);
    expect(availability(result)['12:00']).toBe(true);
  });

  it('is unavailable for everyone when no table is big enough', () => {
    expect(Object.values(availability(run({ partySize: 8 }))).every((v) => v === false)).toBe(true);
  });

  it('ignores inactive tables', () => {
    const result = run({ tables: [{ _id: 't4', seats: 4, isActive: false }] });
    expect(Object.values(availability(result)).every((v) => v === false)).toBe(true);
  });

  it('ignores cancelled bookings and stale pending holds', () => {
    const stale = booking('t4', '12:00', { status: 'pending_payment', holdExpiresAt: new Date('2099-06-13T00:00:00Z') });
    const result = run({
      partySize: 4,
      bookings: [booking('t4', '13:00', { status: 'cancelled' }), stale],
    });
    expect(availability(result)).toEqual({ '12:00': true, '13:00': true, '14:00': true });
  });

  it('counts a live pending hold as taken', () => {
    const live = booking('t4', '12:00', { status: 'pending_payment', holdExpiresAt: new Date('2099-06-16T00:00:00Z') });
    expect(availability(run({ partySize: 4, bookings: [live] }))['12:00']).toBe(false);
  });

  it('marks slots in the past as unavailable', () => {
    const result = run({ now: new Date('2099-06-15T07:45:00Z') }); // 13:15 IST
    expect(availability(result)).toEqual({ '12:00': false, '13:00': false, '14:00': true });
  });
});
