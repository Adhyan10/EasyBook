// Seeded restaurants have no photos of their own. Each one gets a stable, illustrative stock photo:
// mostly food that matches its cuisine, sometimes a dining room. Picked from the restaurant id so a
// restaurant keeps the same photo on every visit.
const INTERIOR_SHARE_OUT_OF_TEN = 3;
const HASH_MULTIPLIER = 31;
const INTERIOR = 'interior';

const CUISINE_POOLS = [
  [/south|udupi|dosa|idli|kerala|andhra|karnataka|tamil/, 'south'],
  [/biryani|mughlai|kebab|hyderabadi|awadhi/, 'biryani'],
  [/chinese|asian|thai|momo|tibetan|noodle/, 'chinese'],
  [/cafe|coffee|bakery|dessert|pizza|burger|italian|ice|tea|sandwich|american/, 'cafe'],
  [/indian|punjabi|north|tandoori/, 'north'],
];

function hashString(text) {
  let hash = 0;
  for (const char of String(text ?? '')) {
    hash = (hash * HASH_MULTIPLIER + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

const foodPoolFor = (cuisine) => {
  const value = String(cuisine ?? '').toLowerCase();
  const match = CUISINE_POOLS.find(([pattern]) => pattern.test(value));
  return match ? match[1] : null;
};

export function pickCover(photos, restaurant) {
  const pools = photos?.pools ?? {};
  const hash = hashString(restaurant?._id);
  const wantsInterior = hash % 10 < INTERIOR_SHARE_OUT_OF_TEN && pools[INTERIOR]?.length > 0;

  let candidates;
  if (wantsInterior) {
    candidates = pools[INTERIOR];
  } else {
    const key = foodPoolFor(restaurant?.cuisine);
    candidates = key && pools[key]?.length
      ? pools[key]
      : Object.entries(pools).filter(([name]) => name !== INTERIOR).flatMap(([, list]) => list);
  }
  if (!candidates || candidates.length === 0) return null;
  return candidates[Math.floor(hash / 10) % candidates.length];
}

export const isInteriorPhoto = (photo) => Boolean(photo?.file?.startsWith(INTERIOR));
