import { useEffect, useRef, useState } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · CICT Workshops` : "CICT Workshops · Aurex'26";
  }, [title]);
}

// Calls `callback` every `delay` ms while delay is not null.
export function useInterval(callback, delay) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return undefined;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Current time, refreshed every `interval` ms (for countdowns).
export function useNow(interval = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), enabled ? interval : null);
  return now;
}

// Runs an async action while tracking pending / error state for a button or form.
// Resolves to { ok: true, data } or { ok: false, error }; never throws.
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setPending(true);
    setError(null);
    try {
      return { ok: true, data: await fn() };
    } catch (err) {
      setError(err);
      return { ok: false, error: err };
    } finally {
      setPending(false);
    }
  };
  return { pending, error, setError, run };
}
