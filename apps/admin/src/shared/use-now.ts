import { useEffect, useState } from 'react';

/** Relógio que avança a cada intervalo, para textos como "atualizado há 4 s". */
export function useNow(intervalMs: number, active: boolean = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}
