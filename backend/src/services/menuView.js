export function groupMenu(items) {
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    byCategory.set(item.category, [...bucket, item]);
  }
  return {
    // Any remaining sample dish keeps the banner: a mixed menu must not read as the restaurant's real menu.
    isSample: items.some((item) => item.isSample),
    categories: [...byCategory].map(([name, grouped]) => ({ name, items: grouped })),
  };
}
