import { useEffect, useState } from 'react';

const TICK_MS = 1000;

const secondsUntil = (iso) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / TICK_MS)) : 0);

export function useCountdown(deadlineIso) {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadlineIso));
  useEffect(() => {
    setSeconds(secondsUntil(deadlineIso));
    if (!deadlineIso) return undefined;
    const timer = setInterval(() => setSeconds(secondsUntil(deadlineIso)), TICK_MS);
    return () => clearInterval(timer);
  }, [deadlineIso]);
  return seconds;
}
