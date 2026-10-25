// A tiny stale-while-revalidate cache for public GET data. Pages show what is cached straight away and
// refresh in the background, so going back to a page you already visited is instant.
const DEFAULT_FRESH_MS = 30_000;
const DEFAULT_MAX_AGE_MS = 5 * 60_000;

export function createQueryCache({ now = Date.now, freshMs = DEFAULT_FRESH_MS, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const store = new Map();
  const inflight = new Map();

  const cache = {
    peek(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (now() - entry.at >= maxAgeMs) {
        store.delete(key);
        return null;
      }
      return entry;
    },
    isFresh(key) {
      const entry = store.get(key);
      return Boolean(entry) && now() - entry.at < freshMs;
    },
    set(key, data) {
      store.set(key, { data, at: now() });
    },
    // Concurrent callers of the same key share one request. Failures are never cached.
    fetch(key, loader, { force = false } = {}) {
      if (!force && inflight.has(key)) return inflight.get(key);
      const request = Promise.resolve()
        .then(loader)
        .then((data) => {
          cache.set(key, data);
          return data;
        })
        .finally(() => {
          if (inflight.get(key) === request) inflight.delete(key);
        });
      inflight.set(key, request);
      return request;
    },
    clear(prefix) {
      for (const key of [...store.keys()]) {
        if (!prefix || key.startsWith(prefix)) store.delete(key);
      }
    },
  };
  return cache;
}

export const queryCache = createQueryCache();
