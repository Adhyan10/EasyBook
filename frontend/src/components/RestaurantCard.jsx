import { Link } from 'react-router-dom';
import { coverClass } from '../lib/cuisine.js';

export default function RestaurantCard({ restaurant, index = 0 }) {
  const place = [restaurant.area, restaurant.city].filter(Boolean).join(', ');
  return (
    <Link
      to={`/restaurants/${restaurant._id}`}
      className="rcard"
      style={{ '--i': index }}
      aria-label={`${restaurant.name}, ${restaurant.cuisine}, ${place}`}
    >
      <div className={`rcard__cover ${coverClass(restaurant.cuisine)}`} aria-hidden="true">
        <span className="rcard__initial">{restaurant.name.trim().charAt(0).toUpperCase()}</span>
      </div>
      <div className="rcard__body">
        <h3 className="rcard__name">{restaurant.name}</h3>
        <p className="rcard__meta">{restaurant.cuisine} · {place}</p>
        <div className="rcard__hours">
          <span>{restaurant.openTime} – {restaurant.closeTime}</span>
        </div>
      </div>
    </Link>
  );
}
