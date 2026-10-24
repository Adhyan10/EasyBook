import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner, Spinner } from '../components/Feedback.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useLoad } from '../hooks/useLoad.js';
import { collectPayment } from '../lib/checkout.js';
import { clock, formatDate, rupees, todayLocal } from '../lib/format.js';

const MAX_PARTY_SIZE = 20;
const SLOT_TAKEN = 409;

function Confirmation({ booking, restaurant }) {
  return (
    <div className="card">
      <p className="banner banner-ok">Booking confirmed. A table is reserved for you.</p>
      <p><strong>{restaurant.name}</strong></p>
      <p>{formatDate(booking.date)} at {booking.slotStart} for {booking.partySize}</p>
      <p><Link to="/my-bookings">View my bookings</Link></p>
    </div>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams();
  const { user, call } = useAuth();
  const restaurant = useLoad(() => call(`/restaurants/${id}`), [id]);
  const [date, setDate] = useState(todayLocal());
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [held, setHeld] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const secondsLeft = useCountdown(held?.booking.holdExpiresAt);

  const checkAvailability = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSelected(null);
    try {
      const data = await call(`/restaurants/${id}/availability?date=${date}&partySize=${partySize}`);
      setSlots(data.slots);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, [call, id, date, partySize]);

  const bookAndPay = async () => {
    setBusy(true);
    setError(null);
    try {
      const hold = await call('/bookings', {
        method: 'POST',
        body: { restaurantId: id, date, slotStart: selected, partySize: Number(partySize) },
      });
      setHeld(hold);
      const payment = await collectPayment({ order: hold.order, bookingId: hold.booking._id, user, call });
      const result = await call('/payments/verify', { method: 'POST', body: payment });
      if (result.booking?.status === 'confirmed') {
        setConfirmed(result.booking);
      } else {
        setError(new Error('Payment received. We are still confirming your table. Check My bookings in a moment.'));
      }
    } catch (err) {
      setError(err);
      if (err.status === SLOT_TAKEN) checkAvailability();
    } finally {
      setHeld(null);
      setBusy(false);
    }
  };

  if (restaurant.loading) return <Spinner />;
  if (restaurant.error) return <ErrorBanner error={restaurant.error} />;
  const place = restaurant.data;
  const deposit = place.depositPerPerson * Number(partySize || 0);
  const isDiner = user?.role === 'diner';

  return (
    <>
      <h1>{place.name}</h1>
      <p className="muted">{place.cuisine} · {place.address}, {place.city} · {place.openTime} – {place.closeTime}</p>
      {place.description && <p>{place.description}</p>}

      {confirmed ? (
        <Confirmation booking={confirmed} restaurant={place} />
      ) : !isDiner ? (
        <p className="banner banner-warn">
          {user ? 'Only diner accounts can book tables.' : <><Link to="/login">Log in</Link> as a diner to book a table.</>}
        </p>
      ) : (
        <section className="card">
          <h2>Book a table</h2>
          <div className="row">
            <label>Date<input type="date" min={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>Guests
              <input type="number" min={1} max={MAX_PARTY_SIZE} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
            </label>
            <button type="button" disabled={busy || !date || !(partySize >= 1)} onClick={checkAvailability}>
              Check availability
            </button>
          </div>
          <ErrorBanner error={error} />
          {slots && <SlotPicker slots={slots} selected={selected} onSelect={setSelected} />}
          {selected && (
            <div className="card">
              <p>
                {formatDate(date)} at <strong>{selected}</strong> for {partySize}. Deposit: <strong>{rupees(deposit)}</strong>{' '}
                ({rupees(place.depositPerPerson)} per person), adjusted against your bill. Free cancellation up to 2 hours before.
              </p>
              {held && (
                <p className="banner banner-warn" role="status">
                  {secondsLeft > 0 ? `Table held for ${clock(secondsLeft)}. Complete payment to confirm.` : 'Hold expired. Please try again.'}
                </p>
              )}
              <button type="button" disabled={busy} onClick={bookAndPay}>
                {busy ? 'Processing…' : `Pay ${rupees(deposit)} and confirm`}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
