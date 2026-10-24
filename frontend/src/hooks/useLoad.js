import { useCallback, useEffect, useRef, useState } from 'react';

export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let isCurrent = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loaderRef
      .current()
      .then((data) => isCurrent && setState({ data, error: null, loading: false }))
      .catch((error) => isCurrent && setState({ data: null, error, loading: false }));
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
