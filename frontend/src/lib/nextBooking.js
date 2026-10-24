const IST_OFFSET = '+05:30';
const startsAt = (booking) => new Date(`${booking.date}T${booking.slotStart}:00${IST_OFFSET}`);

// The diner's next confirmed table in the future, or null. Real bookings only, never a placeholder.
export function nextConfirmedBooking(bookings, now = new Date()) {
  return (
    [...(bookings ?? [])]
      .filter((booking) => booking.status === 'confirmed' && startsAt(booking) > now)
      .sort((a, b) => startsAt(a) - startsAt(b))[0] ?? null
  );
}
