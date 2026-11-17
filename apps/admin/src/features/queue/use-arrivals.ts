import { useEffect, useRef, useState } from 'react';
import type { AdminReportItem, ReportType } from '@safewalk/contracts';
import { useRefreshSummary } from '../../api/queries';
import { findArrivals, snapshotOf, type QueueSnapshot } from './arrivals';

export type Arrival = { id: string; type: ReportType; address: string; at: number };

/** Por quanto tempo o relato recém-chegado fica no topo da fila, marcado como novo. */
const FRESH_MS = 45_000;

/**
 * Relatos que chegaram enquanto a fila estava aberta. `key` identifica os filtros da busca e
 * fica nulo enquanto a resposta desses filtros ainda não chegou.
 */
export function useArrivals(
  key: string | null,
  items: readonly AdminReportItem[],
): readonly Arrival[] {
  const [arrivals, setArrivals] = useState<readonly Arrival[]>([]);
  const snapshot = useRef<QueueSnapshot | null>(null);
  const refreshSummary = useRefreshSummary();

  useEffect(() => {
    if (key === null) return;
    const previous = snapshot.current;
    snapshot.current = snapshotOf(key, items, previous);
    const found = findArrivals(previous, key, items);
    if (found.length === 0) return;
    const at = Date.now();
    setArrivals((current) => [
      ...found.map(({ id, type, address }) => ({ id, type, address, at })),
      ...current.filter((arrival) => !found.some((item) => item.id === arrival.id)),
    ]);
    refreshSummary();
  }, [key, items, refreshSummary]);

  useEffect(() => {
    if (arrivals.length === 0) return;
    const oldest = Math.min(...arrivals.map((arrival) => arrival.at));
    const timer = setTimeout(
      () =>
        setArrivals((current) => current.filter((arrival) => Date.now() - arrival.at < FRESH_MS)),
      Math.max(0, oldest + FRESH_MS - Date.now()) + 20,
    );
    return () => clearTimeout(timer);
  }, [arrivals]);

  return arrivals;
}
