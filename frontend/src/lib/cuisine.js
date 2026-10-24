// Seeded restaurants have no photos, so each card gets a cuisine-coloured cover instead.
const RULES = [
  [/south|udupi|dosa|idli|kerala|andhra|karnataka|tamil/, 'cover--green'],
  [/chinese|asian|thai|momo|tibetan|noodle/, 'cover--chilli'],
  [/cafe|coffee|bakery|dessert|pizza|burger|italian|ice|tea|sandwich|american/, 'cover--violet'],
  [/biryani|mughlai|kebab|hyderabadi|awadhi|regional/, 'cover--plum'],
  [/indian|punjabi|north|tandoori/, 'cover--gold'],
];

export function coverClass(cuisine) {
  const value = String(cuisine ?? '').toLowerCase();
  const match = RULES.find(([pattern]) => pattern.test(value));
  return match ? match[1] : 'cover--ink';
}
