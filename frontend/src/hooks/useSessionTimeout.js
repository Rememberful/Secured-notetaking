import { useEffect, useRef, useCallback, useState } from 'react';

const SESSION_DURATION = 60 * 60 * 1000;
const WARNING_BEFORE   = 60 * 1000;
const CHECK_INTERVAL   = 30 * 1000;

export default function useSessionTimeout({ onWarn, onExpire }) {
  const [warningSeconds, setWarningSeconds] = useState(null);
  const warningIntervalRef = useRef(null);
  const onWarnRef   = useRef(onWarn);
  const onExpireRef = useRef(onExpire);

  useEffect(() => { onWarnRef.current = onWarn; }, [onWarn]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    function check() {
      const loginTime = Number(localStorage.getItem('login_time') || 0);
      if (!loginTime) return;

      const elapsed   = Date.now() - loginTime;
      const remaining = SESSION_DURATION - elapsed;

      if (remaining <= 0) {
        clearInterval(warningIntervalRef.current);
        setWarningSeconds(null);
        onExpireRef.current?.();
        return;
      }

      if (remaining <= WARNING_BEFORE) {
        const secs = Math.ceil(remaining / 1000);
        setWarningSeconds(secs);
        onWarnRef.current?.(secs);

        if (!warningIntervalRef.current) {
          warningIntervalRef.current = setInterval(() => {
            const r = SESSION_DURATION - (Date.now() - Number(localStorage.getItem('login_time') || 0));
            if (r <= 0) {
              clearInterval(warningIntervalRef.current);
              warningIntervalRef.current = null;
              setWarningSeconds(null);
              onExpireRef.current?.();
            } else {
              setWarningSeconds(Math.ceil(r / 1000));
            }
          }, 1000);
        }
      }
    }

    const interval = setInterval(check, CHECK_INTERVAL);
    check();

    return () => {
      clearInterval(interval);
      clearInterval(warningIntervalRef.current);
    };
  }, []);

  const extendSession = useCallback(() => {
    localStorage.setItem('login_time', String(Date.now()));
    clearInterval(warningIntervalRef.current);
    warningIntervalRef.current = null;
    setWarningSeconds(null);
  }, []);

  return { warningSeconds, extendSession };
}