import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async function and tracks its loading, error and data state.
 * Results from stale calls (after unmount or a newer call) are ignored.
 * @param {() => Promise<any>} asyncFn Memoised async loader (wrap it in useCallback).
 * @returns {{ data: any, error: unknown, loading: boolean, reload: () => void }}
 */
export default function useAsync(asyncFn) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const callId = useRef(0);

  const run = useCallback(() => {
    const id = ++callId.current;
    setState((current) => ({ ...current, error: null, loading: true }));
    asyncFn().then(
      (data) => {
        if (id === callId.current) setState({ data, error: null, loading: false });
      },
      (error) => {
        if (id === callId.current) setState((current) => ({ ...current, error, loading: false }));
      },
    );
  }, [asyncFn]);

  useEffect(() => {
    run();
    return () => {
      callId.current += 1;
    };
  }, [run]);

  return { ...state, reload: run };
}
