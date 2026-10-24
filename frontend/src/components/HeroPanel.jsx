import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { nextConfirmedBooking } from '../lib/nextBooking.js';
import ReservationStub from './ReservationStub.jsx';

function HowItWorks() {
  return (
    <ol className="steps card" aria-label="How booking works">
      <li>
        <strong>Find a table</strong>
        <span>Search by restaurant or area, then pick a date and how many guests.</span>
      </li>
      <li>
        <strong>Hold it with a small deposit</strong>
        <span>₹25 per guest keeps the table for you, and it comes off your bill.</span>
      </li>
      <li>
        <strong>Cancel free until 2 hours before</strong>
        <span>Plans change. You get the full deposit back.</span>
      </li>
    </ol>
  );
}

function NextTable() {
  const { call } = useAuth();
  const { data } = useLoad(() => call('/bookings/mine'), []);
  const next = nextConfirmedBooking(data);
  if (!next) return <HowItWorks />;
  return (
    <div>
      <p className="eyebrow" style={{ margin: '0 0 0.5rem' }}>Your next table</p>
      <ReservationStub
        booking={next}
        restaurantName={next.restaurant?.name ?? 'Restaurant'}
        tableLabel={next.table?.label}
      >
        <Link to="/my-bookings" className="btn secondary">View booking</Link>
      </ReservationStub>
    </div>
  );
}

export default function HeroPanel() {
  const { user } = useAuth();
  return user?.role === 'diner' ? <NextTable /> : <HowItWorks />;
}
