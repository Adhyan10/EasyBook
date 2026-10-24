export function groupMenu(items) {
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    byCategory.set(item.category, [...bucket, item]);
  }
  return {
    isSample: items.length > 0 && items.every((item) => item.isSample),
    categories: [...byCategory].map(([name, grouped]) => ({ name, items: grouped })),
  };
}
