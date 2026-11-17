import type { AdminReportItem } from '@safewalk/contracts';

/** O que a fila mostrava na busca anterior: serve de base para saber o que é novo. */
export type QueueSnapshot = {
  /** Filtros da busca; mudar de filtro nunca conta como relato novo. */
  key: string;
  ids: ReadonlySet<string>;
  /** Instante do relato mais recente já visto com estes filtros. */
  newestAt: number;
};

/** Um relato só é anunciado como novo se foi criado há pouco, não por ter voltado à fila. */
const RECENT_MS = 10 * 60_000;

export function snapshotOf(
  key: string,
  items: readonly AdminReportItem[],
  previous: QueueSnapshot | null,
): QueueSnapshot {
  const base = previous?.key === key ? previous.newestAt : 0;
  return {
    key,
    ids: new Set(items.map((item) => item.id)),
    newestAt: items.reduce((newest, item) => Math.max(newest, Date.parse(item.createdAt)), base),
  };
}

/**
 * Relatos que chegaram desde a busca anterior com os mesmos filtros. Na primeira carga, ao
 * trocar de filtro ou quando um caso antigo é reaberto, nada é anunciado.
 */
export function findArrivals(
  previous: QueueSnapshot | null,
  key: string,
  items: readonly AdminReportItem[],
  now: number = Date.now(),
): AdminReportItem[] {
  if (!previous || previous.key !== key) return [];
  return items.filter((item) => {
    const createdAt = Date.parse(item.createdAt);
    return (
      !previous.ids.has(item.id) && createdAt > previous.newestAt && now - createdAt < RECENT_MS
    );
  });
}
