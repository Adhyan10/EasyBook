import { EmptyState } from './Feedback.jsx';

export default function SlotPicker({ slots, selected, onSelect }) {
  if (slots.length === 0) return <EmptyState>This restaurant has no bookable slots.</EmptyState>;
  if (!slots.some((slot) => slot.isAvailable)) {
    return <EmptyState>Fully booked for this date and party size. Try another day or fewer guests.</EmptyState>;
  }
  return (
    <div className="slots" role="group" aria-label="Available time slots">
      {slots.map((slot) => (
        <button
          key={slot.slotStart}
          type="button"
          aria-pressed={selected === slot.slotStart}
          className={`slot${selected === slot.slotStart ? ' selected' : ''}`}
          disabled={!slot.isAvailable}
          onClick={() => onSelect(slot.slotStart)}
        >
          {slot.slotStart}
        </button>
      ))}
    </div>
  );
}
