import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import photos from '../data/coverPhotos.json';
import { coverClass } from '../lib/cuisine.js';
import { pickCover } from '../lib/coverPhoto.js';
import { prefetchRestaurant } from '../lib/prefetch.js';

export default function RestaurantCard({ restaurant, index = 0 }) {
  const place = [restaurant.area, restaurant.city].filter(Boolean).join(', ');
  const photo = pickCover(photos, restaurant);
  const { call } = useAuth();
  const warmUp = () => prefetchRestaurant(call, restaurant._id);
  return (
    <Link
      to={`/restaurants/${restaurant._id}`}
      className="rcard"
      onMouseEnter={warmUp}
      onFocus={warmUp}
      onTouchStart={warmUp}
      style={{ '--i': index }}
      aria-label={`${restaurant.name}, ${restaurant.cuisine}, ${place}`}
    >
      <div className={`rcard__cover ${coverClass(restaurant.cuisine)}`}>
        {photo ? (
          <>
            <img className="rcard__photo" src={`/covers/${photo.file}`} alt="" width="360" height="232" loading="lazy" decoding="async" />
            <span className="photo-note">Illustrative photo</span>
          </>
        ) : (
          <span className="rcard__initial" aria-hidden="true">{restaurant.name.trim().charAt(0).toUpperCase()}</span>
        )}
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
