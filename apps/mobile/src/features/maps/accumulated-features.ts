import type { UrbanFeature } from '@safewalk/contracts';

/** Teto de registros guardados na sessão para o mapa continuar leve. */
export const ACCUMULATED_FEATURES_LIMIT = 16000;

/**
 * Junta os registros recém-carregados aos já vistos nesta sessão. A versão nova de um id
 * substitui a antiga; acima do teto, saem os registros vistos há mais tempo.
 */
export function mergeAccumulatedFeatures(
  previous: ReadonlyMap<string, UrbanFeature>,
  incoming: readonly UrbanFeature[],
  limit = ACCUMULATED_FEATURES_LIMIT,
): Map<string, UrbanFeature> {
  const next = new Map(previous);
  for (const feature of incoming) {
    next.delete(feature.id);
    next.set(feature.id, feature);
  }
  for (const id of next.keys()) {
    if (next.size <= limit) break;
    next.delete(id);
  }
  return next;
}
