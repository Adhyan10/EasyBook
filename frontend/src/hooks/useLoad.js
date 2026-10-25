import { useCallback, useEffect, useRef, useState } from 'react';
import { queryCache } from '../lib/queryCache.js';

// Loads data for a page. With a `key` (public GET data only) it shows cached data immediately and
// refreshes in the background, instead of blocking the page on a spinner.
export function useLoad(loader, deps, { key } = {}) {
  const [state, setState] = useState(() => {
    const hit = key ? queryCache.peek(key) : null;
    return { data: hit?.data ?? null, error: null, loading: !hit };
  });
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const forceNext = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    const hit = key ? queryCache.peek(key) : null;
    const force = forceNext.current;
    forceNext.current = false;

    if (hit) setState({ data: hit.data, error: null, loading: false });
    else setState((previous) => ({ ...previous, loading: true, error: null }));
    if (hit && !force && queryCache.isFresh(key)) return undefined;

    const request = key
      ? queryCache.fetch(key, () => loaderRef.current(), { force })
      : loaderRef.current();
    request
      .then((data) => isCurrent && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (!isCurrent) return;
        // A failed background refresh keeps showing the data we already have.
        setState((previous) => (previous.data ? { ...previous, loading: false } : { data: null, error, loading: false }));
      });
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => {
    forceNext.current = true;
    setVersion((v) => v + 1);
  }, []);
  return { ...state, reload };
}
