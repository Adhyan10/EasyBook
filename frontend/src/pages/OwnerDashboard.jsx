import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';

const EMPTY_FORM = {
  name: '', cuisine: '', city: '', address: '', description: '',
  openTime: '12:00', closeTime: '23:00', slotMinutes: 60,
};

function CreateRestaurantForm({ onCreated }) {
  const { call } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call('/restaurants', { method: 'POST', body: { ...form, slotMinutes: Number(form.slotMinutes) } });
      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Add a restaurant</h2>
      <ErrorBanner error={error} />
      <div className="row">
        <label>Name<input value={form.name} onChange={update('name')} required /></label>
        <label>Cuisine<input value={form.cuisine} onChange={update('cuisine')} required /></label>
        <label>City<input value={form.city} onChange={update('city')} required /></label>
      </div>
      <label>Address<input value={form.address} onChange={update('address')} required /></label>
      <label>Description<textarea value={form.description} onChange={update('description')} rows={2} /></label>
      <div className="row">
        <label>Opens<input type="time" value={form.openTime} onChange={update('openTime')} required /></label>
        <label>Closes<input type="time" value={form.closeTime} onChange={update('closeTime')} required /></label>
        <label>Slot length (minutes)
          <input type="number" min={30} max={180} step={15} value={form.slotMinutes} onChange={update('slotMinutes')} required />
        </label>
      </div>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create restaurant'}</button>
    </form>
  );
}

export default function OwnerDashboard() {
  const { call } = useAuth();
  const { data, error, loading, reload } = useLoad(() => call('/restaurants/mine'), []);

  return (
    <>
      <h1 className="page-title">My restaurants</h1>
      <ErrorBanner error={error} />
      {loading && <Spinner />}
      {data?.length === 0 && <EmptyState>You have no restaurants yet. Add one below, then add its tables.</EmptyState>}
      {data?.map((restaurant) => (
        <div className="card" key={restaurant._id}>
          <h2>{restaurant.name}</h2>
          <p className="muted">
            {restaurant.cuisine} · {restaurant.city} · {restaurant.openTime} – {restaurant.closeTime} · {restaurant.slotMinutes} min slots
          </p>
          <div className="row">
            <Link className="btn" to={`/owner/restaurants/${restaurant._id}/reservations`}>Today&apos;s reservations</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/tables`}>Tables</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/menu`}>Menu</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/deposits`}>Deposits</Link>
          </div>
        </div>
      ))}
      <CreateRestaurantForm onCreated={reload} />
    </>
  );
}
