import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';

const PAGE_SIZE = 9;

export default function Browse() {
  const { call } = useAuth();
  const [filters, setFilters] = useState({ q: '', city: '', cuisine: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);

  const { data, error, loading } = useLoad(() => {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    Object.entries(applied).forEach(([key, value]) => value && params.set(key, value));
    return call(`/restaurants?${params}`);
  }, [applied, page]);

  const update = (field) => (event) => setFilters((previous) => ({ ...previous, [field]: event.target.value }));
  const search = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <h1>Find a table</h1>
      <form className="row card" onSubmit={search}>
        <label>Name<input value={filters.q} onChange={update('q')} placeholder="Name or area, e.g. Spice" /></label>
        <label>City<input value={filters.city} onChange={update('city')} placeholder="e.g. Pune" /></label>
        <label>Cuisine<input value={filters.cuisine} onChange={update('cuisine')} placeholder="e.g. Indian" /></label>
        <button type="submit">Search</button>
      </form>

      <ErrorBanner error={error} />
      {loading && <Spinner />}
      {data && data.items.length === 0 && <EmptyState>No restaurants match your search.</EmptyState>}
      <div className="grid">
        {data?.items.map((restaurant) => (
          <Link key={restaurant._id} to={`/restaurants/${restaurant._id}`} className="card">
            <h2>{restaurant.name}</h2>
            <p className="muted">
              {restaurant.cuisine} · {restaurant.area ? `${restaurant.area}, ` : ''}{restaurant.city}
            </p>
            <p>
              {restaurant.openTime} – {restaurant.closeTime}
              {restaurant.isSample && <span className="badge"> sample hours</span>}
            </p>
          </Link>
        ))}
      </div>

      {data && totalPages > 1 && (
        <div className="row">
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
