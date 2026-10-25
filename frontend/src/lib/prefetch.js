import { queryCache } from './queryCache.js';

// Start loading a restaurant's page data when someone hovers, focuses or touches its card.
export function prefetchRestaurant(call, id) {
  for (const path of [`/restaurants/${id}`, `/restaurants/${id}/menu`]) {
    if (!queryCache.isFresh(path)) queryCache.fetch(path, () => call(path)).catch(() => {});
  }
}
