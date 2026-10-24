import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { DEPOSIT_LABEL, formatDate, rupees, STATUS_LABEL } from '../lib/format.js';

const IST_OFFSET = '+05:30';
const MS_PER_HOUR = 3_600_000;
const REFUND_CUTOFF_HOURS = 2;

const hoursUntil = (booking) =>
  (new Date(`${booking.date}T${booking.slotStart}:00${IST_OFFSET}`).getTime() - Date.now()) / MS_PER_HOUR;

function cancelWarning(booking) {
  const refundable = hoursUntil(booking) >= REFUND_CUTOFF_HOURS;
  return refundable
    ? `Cancel this booking? Your ${rupees(booking.deposit.amount)} deposit will be refunded.`
    : `Cancel this booking? It starts in under ${REFUND_CUTOFF_HOURS} hours, so your ${rupees(booking.deposit.amount)} deposit will NOT be refunded.`;
}

export default function MyBookings() {
  const { call } = useAuth();
  const { data, error, loading, reload } = useLoad(() => call('/bookings/mine'), []);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const cancel = async (booking) => {
    if (!window.confirm(cancelWarning(booking))) return;
    setBusyId(booking._id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await call(`/bookings/${booking._id}/cancel`, { method: 'PATCH' });
      setNotice(`Booking cancelled. Deposit ${DEPOSIT_LABEL[result.deposit.status]?.toLowerCase() ?? 'settled'}.`);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
      reload();
    }
  };

  return (
    <>
      <h1>My bookings</h1>
      <ErrorBanner error={error ?? actionError} />
      {notice && <p className="banner banner-ok" role="status">{notice}</p>}
      {loading && <Spinner />}
      {data?.length === 0 && <EmptyState>No bookings yet. <Link to="/">Find a table</Link></EmptyState>}
      {data?.map((booking) => (
        <div className="card" key={booking._id}>
          <div className="row">
            <h2>{booking.restaurant?.name ?? 'Restaurant'}</h2>
            <span className={`badge ${booking.status}`}>{STATUS_LABEL[booking.status]}</span>
          </div>
          <p>{formatDate(booking.date)} at {booking.slotStart} · {booking.partySize} guests · Table {booking.table?.label ?? 'n/a'}</p>
          {booking.deposit && (
            <p className="muted">
              Deposit {rupees(booking.deposit.amount)}:{' '}
              <span className={`badge ${booking.deposit.status}`}>{DEPOSIT_LABEL[booking.deposit.status]}</span>
              {booking.deposit.adjustedAt && ' · adjusted against your bill'}
            </p>
          )}
          {booking.status === 'confirmed' && hoursUntil(booking) > 0 && (
            <button type="button" className="danger" disabled={busyId === booking._id} onClick={() => cancel(booking)}>
              {busyId === booking._id ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
