import { useCallback, useEffect, useRef, useState } from 'react';

type Runner = (onToken: (delta: string, full: string) => void, signal: AbortSignal) => Promise<string>;

/** Runs a streaming AI call, exposing live text, status and cancel. */
export function useStream(initial = '') {
  const [text, setText] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(async (runner: Runner): Promise<string | null> => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setRunning(true);
    setError(null);
    setText('');
    try {
      const full = await runner((_d, f) => setText(f), c.signal);
      setText(full);
      return full;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Something went wrong.');
      return null;
    } finally {
      if (ctrl.current === c) setRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setRunning(false);
  }, []);

  return { text, setText, running, error, run, stop };
}
