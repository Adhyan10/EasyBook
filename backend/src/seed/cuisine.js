const DEFAULT_CUISINE_LABEL = 'Cuisine not listed';

// Checked in order; the first group with a matching keyword wins.
const RULES = Object.freeze([
  ['south_indian', ['south_indian', 'udupi', 'dosa', 'idli', 'kerala', 'andhra', 'karnataka', 'tamil']],
  ['biryani', ['biryani', 'hyderabadi', 'mughlai', 'kebab', 'awadhi']],
  ['chinese', ['chinese', 'asian', 'thai', 'momo', 'tibetan', 'noodle']],
  ['cafe', ['cafe', 'coffee', 'bakery', 'dessert', 'ice_cream', 'tea', 'sandwich', 'pizza', 'burger', 'italian']],
  ['north_indian', ['north_indian', 'punjabi', 'tandoori', 'indian']],
]);

const firstValue = (tag) => String(tag ?? '').split(';')[0].trim().toLowerCase();

export function pickTemplate(cuisineTag) {
  const value = firstValue(cuisineTag);
  if (!value) return 'multi';
  const match = RULES.find(([, keywords]) => keywords.some((keyword) => value.includes(keyword)));
  return match ? match[0] : 'multi';
}

export function titleCaseCuisine(cuisineTag) {
  const value = firstValue(cuisineTag);
  if (!value) return DEFAULT_CUISINE_LABEL;
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
