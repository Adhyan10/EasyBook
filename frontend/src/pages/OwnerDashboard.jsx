import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { queryCache } from '../lib/queryCache.js';

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

const PAGE_SIZE = 10;

export default function OwnerDashboard() {
  const { call, user } = useAuth();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page, limit: PAGE_SIZE });
  if (applied) params.set('q', applied);
  const path = `/restaurants/mine?${params}`;
  // Keyed by owner so one account's list is never shown to another account in the same tab.
  const { data, error, loading, reload } = useLoad(() => call(path), [path], { key: `${user.id}:${path}` });

  const submit = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  };
  const onCreated = () => {
    queryCache.clear(`${user.id}:/restaurants/mine`);
    reload();
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <h1 className="page-title">My restaurants</h1>
      <form className="search" onSubmit={submit} role="search" style={{ marginBottom: '1rem' }}>
        <label>
          Find one of your restaurants
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or area" />
        </label>
        <button type="submit" className="secondary">Search</button>
      </form>
      <ErrorBanner error={error} />
      {loading && !data && <Spinner />}
      {data && (
        <p className="small muted">
          {data.total} {data.total === 1 ? 'restaurant' : 'restaurants'}
          {applied ? ` matching "${applied}"` : ''}
        </p>
      )}
      {data?.items.length === 0 && !applied && (
        <EmptyState>You have no restaurants yet. Add one below, then add its tables.</EmptyState>
      )}
      {data?.items.length === 0 && applied && <EmptyState>None of your restaurants match that search.</EmptyState>}
      {data?.items.map((restaurant) => (
        <div className="card" key={restaurant._id}>
          <h2>{restaurant.name}</h2>
          <p className="muted">
            {restaurant.cuisine} · {restaurant.area ? `${restaurant.area}, ` : ''}{restaurant.city} · {restaurant.openTime} – {restaurant.closeTime} · {restaurant.slotMinutes} min slots
          </p>
          <div className="row">
            <Link className="btn" to={`/owner/restaurants/${restaurant._id}/reservations`}>Today&apos;s reservations</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/tables`}>Tables</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/menu`}>Menu</Link>
            <Link className="btn secondary" to={`/owner/restaurants/${restaurant._id}/deposits`}>Deposits</Link>
          </div>
        </div>
      ))}
      {data && totalPages > 1 && (
        <div className="row row--center pager">
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small muted">Page {page} of {totalPages}</span>
          <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      <CreateRestaurantForm onCreated={onCreated} />
    </>
  );
}
