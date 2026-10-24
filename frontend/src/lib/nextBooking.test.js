import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextConfirmedBooking } from './nextBooking.js';

const NOW = new Date('2026-10-24T10:00:00Z'); // 15:30 IST
const booking = (id, date, slotStart, status = 'confirmed') => ({ _id: id, date, slotStart, status });

describe('nextConfirmedBooking', () => {
  it('returns null when there are no bookings or no data yet', () => {
    assert.equal(nextConfirmedBooking([], NOW), null);
    assert.equal(nextConfirmedBooking(undefined, NOW), null);
    assert.equal(nextConfirmedBooking(null, NOW), null);
  });

  it('never returns a booking that is not confirmed', () => {
    const list = [
      booking('a', '2026-10-25', '19:00', 'pending_payment'),
      booking('b', '2026-10-25', '20:00', 'cancelled'),
      booking('c', '2026-10-25', '21:00', 'expired'),
      booking('d', '2026-10-25', '18:00', 'completed'),
    ];
    assert.equal(nextConfirmedBooking(list, NOW), null);
  });

  it('ignores confirmed bookings whose slot already started', () => {
    assert.equal(nextConfirmedBooking([booking('a', '2026-10-24', '15:00')], NOW), null);
  });

  it('picks the earliest upcoming confirmed booking', () => {
    const list = [
      booking('later', '2026-10-26', '12:00'),
      booking('soonest', '2026-10-24', '19:00'),
      booking('middle', '2026-10-25', '09:00'),
    ];
    assert.equal(nextConfirmedBooking(list, NOW)._id, 'soonest');
  });

  it('does not reorder the list it was given', () => {
    const list = [booking('b', '2026-10-26', '12:00'), booking('a', '2026-10-24', '19:00')];
    nextConfirmedBooking(list, NOW);
    assert.deepEqual(list.map((x) => x._id), ['b', 'a']);
  });
});
