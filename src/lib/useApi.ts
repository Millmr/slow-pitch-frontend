import { useCallback, useEffect, useState, type DependencyList } from "react";
import { ApiError, toApiError } from "../api/client";

interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Load data when `deps` change. Keeps the previous data while reloading so
 * screens don't flash, and ignores responses that arrive after unmount.
 */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<ApiState<T>>({ data: undefined, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    loader().then(
      (data) => active && setState({ data, error: null, loading: false }),
      (error: unknown) => active && setState({ data: undefined, error: toApiError(error), loading: false }),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload, setData };
}

/** Wrap an async action with pending/error state for buttons and forms. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <R,>(action: () => Promise<R>): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(toApiError(err).message);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, setError, run };
}

/** True once `active` has stayed true for `delayMs`, e.g. to explain a slow wait. */
export function useSlow(active: boolean, delayMs = 5000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return slow;
}
