import { formatDate, rupees, STATUS_LABEL } from '../lib/format.js';

// A booking drawn as a torn table slip: details on the left, status and code on the stub.
export default function ReservationStub({ booking, restaurantName, tableLabel, deposit, enter = false, muted = false, children }) {
  const code = String(booking._id).slice(-6).toUpperCase();
  return (
    <div className="stub-wrap">
    <article className={`stub${enter ? ' stub--enter' : ''}${muted ? ' stub--muted' : ''}`} aria-label={`Reservation at ${restaurantName}`}>
      <div className="stub__main">
        <div className="stub__title">
          <h2>{restaurantName}</h2>
        </div>
        <div className="stub__time">{booking.slotStart}</div>
        <p className="stub__meta">
          {formatDate(booking.date)} · {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}
          {tableLabel ? ` · Table ${tableLabel}` : ''}
        </p>
        {children && <div className="stub__actions">{children}</div>}
      </div>
      <div className="stub__tear" aria-hidden="true" />
      <div className="stub__side">
        <span className={`stamp ${booking.status}`}>{STATUS_LABEL[booking.status] ?? booking.status}</span>
        <div>
          <div className="stub__code">№ {code}</div>
          {deposit && (
            <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
              Deposit {rupees(deposit.amount)} · {deposit.label}
            </p>
          )}
        </div>
      </div>
    </article>
    </div>
  );
}
