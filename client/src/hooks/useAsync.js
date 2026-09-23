import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async loader on mount and whenever `deps` change.
// Returns { data, error, loading, reload, setData }.
// reload({ silent: true }) refreshes without clearing the current data
// (use it after an action so the page doesn't flash a skeleton).
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async ({ silent = false } = {}) => {
    const id = ++latest.current;
    if (!silent) setState({ data: undefined, error: null, loading: true });
    try {
      const data = await loader();
      if (id === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === latest.current) setState((s) => ({ data: silent ? s.data : undefined, error, loading: false }));
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
    [],
  );

  return { ...state, reload: load, setData };
}
