import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner, Spinner } from '../components/Feedback.jsx';
import Menu from '../components/Menu.jsx';
import ReservationStub from '../components/ReservationStub.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useLoad } from '../hooks/useLoad.js';
import { collectPayment } from '../lib/checkout.js';
import { clock, formatDate, rupees, todayLocal } from '../lib/format.js';

const MAX_PARTY_SIZE = 20;
const SLOT_TAKEN = 409;

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

  // A live hold that runs out goes back to the picker.
  useEffect(() => {
    if (held && secondsLeft === 0) {
      setHeld(null);
      setSlots(null);
      setSelected(null);
      setError(new Error('The 10-minute hold ended and the table was released. Pick a slot to try again.'));
    }
  }, [held, secondsLeft]);

  const changeDate = (value) => {
    setDate(value);
    setSlots(null);
    setSelected(null);
  };
  const changeParty = (value) => {
    setPartySize(value);
    setSlots(null);
    setSelected(null);
  };

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

  const pay = async (hold) => {
    setBusy(true);
    setError(null);
    try {
      const payment = await collectPayment({ order: hold.order, bookingId: hold.booking._id, user, call });
      const result = await call('/payments/verify', { method: 'POST', body: payment });
      if (result.booking?.status === 'confirmed') {
        setConfirmed({ booking: result.booking, table: hold.table });
        setHeld(null);
      } else {
        setError(new Error('Payment received. We are still confirming your table. Check My bookings in a moment.'));
        setHeld(null);
      }
    } catch (err) {
      setError(err);
      if (err.status) setHeld(null);
    } finally {
      setBusy(false);
    }
  };

  const holdAndPay = async () => {
    setBusy(true);
    setError(null);
    try {
      const hold = await call('/bookings', {
        method: 'POST',
        body: { restaurantId: id, date, slotStart: selected, partySize: Number(partySize) },
      });
      setHeld(hold);
      setBusy(false);
      await pay(hold);
    } catch (err) {
      setError(err);
      if (err.status === SLOT_TAKEN) checkAvailability();
      setBusy(false);
    }
  };

  if (restaurant.loading && !restaurant.data) return <Spinner />;
  if (restaurant.error) return <ErrorBanner error={restaurant.error} />;
  const place = restaurant.data;
  const deposit = place.depositPerPerson * Number(partySize || 0);
  const isDiner = user?.role === 'diner';
  const address = place.address.includes(place.city) ? place.address : `${place.address}, ${place.city}`;

  return (
    <>
      <Link to="/" className="back-link">← All restaurants</Link>
      <header className="detail-head">
        <h1>{place.name}</h1>
        <p className="muted">{address}</p>
        <div className="chips">
          <span className="chip">{place.cuisine}</span>
          <span className="chip mono">{place.openTime} – {place.closeTime}</span>
          <span className="chip">{rupees(place.depositPerPerson)} deposit per guest</span>
          {place.isSample && <span className="badge sample">sample hours and tables</span>}
        </div>
        {place.description && <p style={{ marginTop: '0.75rem' }}>{place.description}</p>}
      </header>

      <div className="detail">
        <div><Menu restaurantId={id} /></div>

        <section className="card booking-panel" aria-labelledby="book-title">
          {confirmed ? (
            <>
              <h2 id="book-title">You&apos;re booked</h2>
              <ReservationStub
                enter
                booking={confirmed.booking}
                restaurantName={place.name}
                tableLabel={confirmed.table?.label}
                deposit={{ amount: deposit, label: 'Paid' }}
              />
              <Link to="/my-bookings" className="btn block">View my bookings</Link>
            </>
          ) : !isDiner ? (
            <>
              <h2 id="book-title">Book a table</h2>
              <p className="banner banner-warn" style={{ margin: 0 }}>
                {user ? 'Only diner accounts can book tables.' : <><Link to="/login">Log in</Link> as a diner to book a table.</>}
              </p>
            </>
          ) : held ? (
            <>
              <h2 id="book-title">Table held</h2>
              <p className="countdown" role="timer" aria-live="off">{clock(secondsLeft)}</p>
              <p className="muted small">Pay within this time or the table is released.</p>
              <dl className="summary">
                <dt>When</dt><dd>{formatDate(held.booking.date)}, {held.booking.slotStart}</dd>
                <dt>Guests</dt><dd>{held.booking.partySize}</dd>
                <dt>Deposit</dt><dd className="total">{rupees(held.depositAmount)}</dd>
              </dl>
              <ErrorBanner error={error} />
              <button type="button" className="block gold" disabled={busy} onClick={() => pay(held)}>
                {busy ? 'Processing…' : `Pay ${rupees(held.depositAmount)} to confirm`}
              </button>
            </>
          ) : (
            <>
              <h2 id="book-title">Book a table</h2>
              <div className="form">
                <div className="row">
                  <label className="field-grow">
                    Date
                    <input type="date" min={todayLocal()} value={date} onChange={(e) => changeDate(e.target.value)} />
                  </label>
                  <label style={{ width: '6rem' }}>
                    Guests
                    <input
                      type="number"
                      min={1}
                      max={MAX_PARTY_SIZE}
                      value={partySize}
                      onChange={(e) => changeParty(e.target.value)}
                    />
                  </label>
                </div>
                <button type="button" className="secondary" disabled={busy || !date || !(partySize >= 1)} onClick={checkAvailability}>
                  {busy && !slots ? 'Checking…' : 'Show available times'}
                </button>
                <ErrorBanner error={error} />
                {slots && <SlotPicker slots={slots} selected={selected} onSelect={setSelected} />}
                {selected && (
                  <>
                    <dl className="summary">
                      <dt>When</dt><dd>{formatDate(date)}, {selected}</dd>
                      <dt>Guests</dt><dd>{partySize}</dd>
                      <dt>Deposit</dt><dd className="total">{rupees(deposit)}</dd>
                    </dl>
                    <p className="small muted" style={{ margin: 0 }}>
                      {rupees(place.depositPerPerson)} per guest, taken off your bill. Cancel 2+ hours before for a full refund.
                    </p>
                    <button type="button" className="block" disabled={busy} onClick={holdAndPay}>
                      {busy ? 'Holding your table…' : `Hold table and pay ${rupees(deposit)}`}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
