import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeroPanel from '../components/HeroPanel.jsx';
import RestaurantCard from '../components/RestaurantCard.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';

const PAGE_SIZE = 12;

export default function Browse() {
  const { call, user } = useAuth();
  const [filters, setFilters] = useState({ q: '', cuisine: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page, limit: PAGE_SIZE });
  Object.entries(applied).forEach(([field, value]) => value && params.set(field, value));
  const listPath = `/restaurants?${params}`;
  const { data, error, loading } = useLoad(() => call(listPath), [listPath], { key: listPath });

  const update = (field) => (event) => setFilters((previous) => ({ ...previous, [field]: event.target.value }));
  const search = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isFiltered = Boolean(applied.q || applied.cuisine);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Book a table in Bengaluru.</h1>
          <p className="hero__lede">
            Pick a slot and pay a <strong>₹25-per-guest deposit</strong> to hold it. Cancel up to 2 hours before
            and get it all back.
          </p>
          <form className="search" onSubmit={search} role="search">
            <label>
              Restaurant or area
              <input value={filters.q} onChange={update('q')} placeholder="e.g. Indiranagar" />
            </label>
            <label>
              Cuisine
              <input value={filters.cuisine} onChange={update('cuisine')} placeholder="e.g. Chinese" />
            </label>
            <button type="submit">Find tables</button>
          </form>
          {!user && (
            <p className="small muted" style={{ marginTop: '0.75rem' }}>
              Own a restaurant? <Link to="/register">Create an owner account</Link> and list your tables.
            </p>
          )}
        </div>
        <HeroPanel />
      </section>

      <div className="section-head">
        <h2>{isFiltered ? 'Matching restaurants' : 'Restaurants near you'}</h2>
        {data && <span className="small muted">{data.total} {data.total === 1 ? 'restaurant' : 'restaurants'}</span>}
      </div>

      <ErrorBanner error={error} />
      {loading && !data && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState>No restaurants match that search. Try a broader area or clear the cuisine.</EmptyState>
      )}
      <div className="cards" aria-busy={loading}>
        {data?.items.map((restaurant, index) => (
          <RestaurantCard key={restaurant._id} restaurant={restaurant} index={index} />
        ))}
      </div>

      {data && totalPages > 1 && (
        <div className="row row--center pager">
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small muted">Page {page} of {totalPages}</span>
          <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
