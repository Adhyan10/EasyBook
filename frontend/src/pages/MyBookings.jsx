import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import ReservationStub from '../components/ReservationStub.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useLoad } from '../hooks/useLoad.js';
import { collectPayment } from '../lib/checkout.js';
import { clock, DEPOSIT_LABEL, rupees } from '../lib/format.js';

const IST_OFFSET = '+05:30';
const MS_PER_HOUR = 3_600_000;
const REFUND_CUTOFF_HOURS = 2;
const ACTIVE = ['pending_payment', 'confirmed', 'seated'];

const hoursUntil = (booking) =>
  (new Date(`${booking.date}T${booking.slotStart}:00${IST_OFFSET}`).getTime() - Date.now()) / MS_PER_HOUR;

function cancelWarning(booking) {
  const refundable = hoursUntil(booking) >= REFUND_CUTOFF_HOURS;
  return refundable
    ? `Cancel this booking? Your ${rupees(booking.deposit.amount)} deposit will be refunded.`
    : `Cancel this booking? It starts in under ${REFUND_CUTOFF_HOURS} hours, so your ${rupees(booking.deposit.amount)} deposit will NOT be refunded.`;
}

function HoldTimer({ expiresAt }) {
  const seconds = useCountdown(expiresAt);
  return <span className="mono small">{seconds > 0 ? `Held for ${clock(seconds)}` : 'Hold ended'}</span>;
}

export default function MyBookings() {
  const { call, user } = useAuth();
  const { data, error, loading, reload } = useLoad(() => call('/bookings/mine'), []);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const run = async (booking, action) => {
    setBusyId(booking._id);
    setActionError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const cancel = (booking) => {
    if (!window.confirm(cancelWarning(booking))) return undefined;
    return run(booking, async () => {
      const result = await call(`/bookings/${booking._id}/cancel`, { method: 'PATCH' });
      setNotice(`Booking cancelled. Deposit ${DEPOSIT_LABEL[result.deposit.status]?.toLowerCase() ?? 'settled'}.`);
    });
  };

  const resume = (booking) =>
    run(booking, async () => {
      const { order } = await call(`/bookings/${booking._id}/order`);
      const payment = await collectPayment({ order, bookingId: booking._id, user, call });
      await call('/payments/verify', { method: 'POST', body: payment });
      setNotice('Payment received. Your table is confirmed.');
    });

  const active = data?.filter((b) => ACTIVE.includes(b.status)) ?? [];
  const past = data?.filter((b) => !ACTIVE.includes(b.status)) ?? [];

  const stubFor = (booking) => {
    const isPending = booking.status === 'pending_payment' && booking.holdExpiresAt;
    return (
      <ReservationStub
        key={booking._id}
        booking={booking}
        restaurantName={booking.restaurant?.name ?? 'Restaurant'}
        tableLabel={booking.table?.label}
        muted={!ACTIVE.includes(booking.status)}
        deposit={booking.deposit && { amount: booking.deposit.amount, label: DEPOSIT_LABEL[booking.deposit.status] }}
      >
        {isPending && new Date(booking.holdExpiresAt) > new Date() && (
          <>
            <button type="button" className="gold" disabled={busyId === booking._id} onClick={() => resume(booking)}>
              {busyId === booking._id ? 'Opening payment…' : 'Resume payment'}
            </button>
            <HoldTimer expiresAt={booking.holdExpiresAt} />
          </>
        )}
        {booking.status === 'confirmed' && hoursUntil(booking) > 0 && (
          <button type="button" className="danger" disabled={busyId === booking._id} onClick={() => cancel(booking)}>
            {busyId === booking._id ? 'Cancelling…' : 'Cancel booking'}
          </button>
        )}
      </ReservationStub>
    );
  };

  return (
    <>
      <h1 className="page-title">My bookings</h1>
      <ErrorBanner error={error ?? actionError} />
      {notice && <p className="banner banner-ok" role="status">{notice}</p>}
      {loading && !data && <Spinner />}
      {data?.length === 0 && <EmptyState>No bookings yet. <Link to="/">Find a table</Link> and hold one in a minute.</EmptyState>}
      {active.length > 0 && <h2 className="section-title">Coming up</h2>}
      {active.map(stubFor)}
      {past.length > 0 && <h2 className="section-title">Past and cancelled</h2>}
      {past.map(stubFor)}
    </>
  );
}
