import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { rupees } from '../lib/format.js';
import { EmptyState, ErrorBanner, Spinner } from './Feedback.jsx';

function VegMark({ isVeg }) {
  return (
    <span className={`veg-mark ${isVeg ? 'veg' : 'nonveg'}`} role="img" aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'} />
  );
}

export default function Menu({ restaurantId }) {
  const { call } = useAuth();
  const { data, error, loading } = useLoad(() => call(`/restaurants/${restaurantId}/menu`), [restaurantId]);

  return (
    <section className="card">
      <h2>Menu</h2>
      <ErrorBanner error={error} />
      {loading && !data && <Spinner />}
      {data?.isSample && (
        <p className="banner banner-warn" style={{ marginTop: '0.6rem' }}>
          Sample menu. Dishes marked &quot;sample&quot; are generic for this cuisine, not this restaurant&apos;s actual menu.
        </p>
      )}
      {data && data.categories.length === 0 && <EmptyState>This restaurant has not added a menu yet.</EmptyState>}
      {data?.categories.map((category) => (
        <div key={category.name}>
          <h3 className="menu-category">{category.name}</h3>
          {category.items.map((item) => (
            <div className="menu-row" key={item._id}>
              <VegMark isVeg={item.isVeg} />
              <div className="menu-name">
                {item.name}
                {item.description && <span className="muted"> · {item.description}</span>}
                {item.isSample && <span className="muted small"> · sample</span>}
              </div>
              <span className="menu-price">{rupees(item.price)}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
