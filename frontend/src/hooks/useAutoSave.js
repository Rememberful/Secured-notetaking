import { useEffect, useRef, useCallback, useState } from 'react';

export default function useAutoSave(saveFn, deps, { delay = 3000, minContent = null } = {}) {
  const [status, setStatus] = useState('idle');
  const timerRef   = useRef(null);
  const saveFnRef  = useRef(saveFn);
  const dirtyRef   = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { saveFnRef.current = saveFn; }, [saveFn]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    if (minContent !== null && !String(minContent).trim()) return;

    dirtyRef.current = false;
    if (mountedRef.current) setStatus('saving');
    try {
      await saveFnRef.current();
      if (mountedRef.current) {
        setStatus('saved');
        setTimeout(() => {
          if (mountedRef.current) setStatus('idle');
        }, 2500);
      }
    } catch {
      if (mountedRef.current) setStatus('error');
    }
  }, [minContent]);

  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    if (!mountedRef.current) return;
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, delay);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, delay, doSave]);

  const flushSave = useCallback(async () => {
    clearTimeout(timerRef.current);
    await doSave();
  }, [doSave]);

  return { status, flushSave, dirtyRef };
}