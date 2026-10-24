// Seat counts per layout; every layout has 4 to 6 tables, at least one 2-seater and one 4-seater.
const LAYOUTS = Object.freeze([
  [2, 2, 4, 4],
  [2, 2, 4, 4, 6],
  [2, 2, 4, 4, 6, 8],
  [2, 4, 4, 6, 8],
  [2, 2, 2, 4, 4, 6],
]);

const HASH_MULTIPLIER = 31;

export function hashString(text) {
  let hash = 0;
  for (const char of String(text)) {
    hash = (hash * HASH_MULTIPLIER + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

export function tableLayoutFor(externalId) {
  const seats = LAYOUTS[hashString(externalId) % LAYOUTS.length];
  return seats.map((count, index) => ({ label: `T${index + 1}`, seats: count }));
}
