import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { DEPOSIT_LABEL, formatDate, rupees, STATUS_LABEL, todayLocal } from '../lib/format.js';

const NEXT_ACTIONS = Object.freeze({
  confirmed: [
    { status: 'seated', label: 'Seat', style: '' },
    { status: 'no_show', label: 'No-show', style: 'secondary' },
    { status: 'cancelled', label: 'Cancel', style: 'danger' },
  ],
  seated: [{ status: 'completed', label: 'Complete', style: '' }],
});

const canAdjust = (booking) =>
  ['seated', 'completed'].includes(booking.status) && booking.deposit?.status === 'paid' && !booking.deposit.adjustedAt;

function depositNote(deposit) {
  if (!deposit) return '—';
  const adjusted = deposit.adjustedAt ? ' (adjusted)' : '';
  return `${rupees(deposit.amount)} ${DEPOSIT_LABEL[deposit.status]}${adjusted}`;
}

export default function DayReservations() {
  const { id } = useParams();
  const { call } = useAuth();
  const [date, setDate] = useState(todayLocal());
  const { data, error, loading, reload } = useLoad(() => call(`/restaurants/${id}/bookings?date=${date}`), [id, date]);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const run = async (bookingId, action) => {
    setBusyId(bookingId);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const changeStatus = (booking, status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this booking? The diner gets a full refund.')) return undefined;
    return run(booking._id, () => call(`/bookings/${booking._id}/status`, { method: 'PATCH', body: { status } }));
  };
  const adjust = (booking) => run(booking._id, () => call(`/bookings/${booking._id}/adjust`, { method: 'PATCH' }));

  return (
    <>
      <Link to="/owner" className="back-link">← My restaurants</Link>
      <h1 className="page-title">Reservations</h1>
      <div className="row">
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <Link className="btn secondary" to={`/owner/restaurants/${id}/deposits`}>Deposits ledger</Link>
      </div>
      <p className="muted">{formatDate(date)}</p>
      <ErrorBanner error={error ?? actionError} />
      {loading && <Spinner />}
      {data?.length === 0 && <EmptyState>No reservations for this day.</EmptyState>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table>
          <thead><tr><th>Time</th><th>Guest</th><th>Party</th><th>Table</th><th>Status</th><th>Deposit</th><th /></tr></thead>
          <tbody>
            {data.map((booking) => (
              <tr key={booking._id}>
                <td>{booking.slotStart}</td>
                <td>{booking.diner?.name ?? 'Guest'}</td>
                <td>{booking.partySize}</td>
                <td>{booking.table?.label ?? 'Removed'}</td>
                <td><span className={`badge ${booking.status}`}>{STATUS_LABEL[booking.status]}</span></td>
                <td>{depositNote(booking.deposit)}</td>
                <td className="row">
                  {(NEXT_ACTIONS[booking.status] ?? []).map((action) => (
                    <button key={action.status} type="button" className={action.style}
                      disabled={busyId === booking._id} onClick={() => changeStatus(booking, action.status)}>
                      {action.label}
                    </button>
                  ))}
                  {canAdjust(booking) && (
                    <button type="button" className="secondary" disabled={busyId === booking._id} onClick={() => adjust(booking)}>
                      Adjust deposit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </>
  );
}
