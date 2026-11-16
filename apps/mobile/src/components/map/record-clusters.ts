import type { GeoJSONSourceSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { MapRecordGroup } from './real-map.types';

/** Registros em geral, semáforos e locais de ajuda (delegacias e hospitais) se agrupam em fontes
 * separadas: afastando o mapa, cada um continua com o próprio ícone, em vez de sumir num grupo
 * misto. A última fonte fica por cima. */
export const RECORD_SOURCE = 'safewalk-route-records';
export const SIGNAL_SOURCE = 'safewalk-signal-records';
export const HELP_SOURCE = 'safewalk-help-records';
export const RECORD_SOURCES = [RECORD_SOURCE, SIGNAL_SOURCE, HELP_SOURCE] as const;
export type RecordSourceId = (typeof RECORD_SOURCES)[number];
export const RECORD_CLUSTER_MAX_ZOOM = 17;
export const RECORD_CLUSTER_RADIUS = 40;

/** Categorias contadas dentro de cada grupo, em ordem de desempate do ícone. */
export const RECORD_CATEGORIES = [
  'signals',
  'reports',
  'floods',
  'sidewalks',
  'lighting',
  'accessibility',
  'police',
  'health',
  'potholes',
  'obstacles',
  'brokenSidewalk',
  'drains',
  'trees',
  'history',
  'unknown',
] as const;

export const recordLayerIds = (source: RecordSourceId) => ({
  clusters: `${source}-clusters`,
  clusterIcons: `${source}-cluster-icons`,
  count: `${source}-count`,
  points: `${source}-points`,
  icons: `${source}-icons`,
});
export const RECORD_LAYERS = RECORD_SOURCES.flatMap((source) =>
  Object.values(recordLayerIds(source)),
);

/** Cada grupo soma quantos registros de cada categoria contém. */
export const RECORD_CLUSTER_PROPERTIES: NonNullable<
  GeoJSONSourceSpecification['clusterProperties']
> = Object.fromEntries(
  RECORD_CATEGORIES.map((category) => [
    category,
    ['+', ['case', ['==', ['get', 'category'], category], 1, 0]],
  ]),
);

export const EMPTY_RECORDS: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

export function splitRecordSources(
  records: FeatureCollection<Point>,
): Record<RecordSourceId, FeatureCollection<Point>> {
  const signals: Feature<Point>[] = [];
  const help: Feature<Point>[] = [];
  const others: Feature<Point>[] = [];
  for (const feature of records.features) {
    const category = feature.properties?.category;
    (category === 'signals'
      ? signals
      : category === 'police' || category === 'health'
        ? help
        : others
    ).push(feature);
  }
  return {
    [RECORD_SOURCE]: { type: 'FeatureCollection', features: others },
    [SIGNAL_SOURCE]: { type: 'FeatureCollection', features: signals },
    [HELP_SOURCE]: { type: 'FeatureCollection', features: help },
  };
}

export interface RecordClusterSource {
  getClusterLeaves(clusterId: number, limit: number, offset: number): Promise<Feature[]>;
  getClusterExpansionZoom(clusterId: number): Promise<number>;
}
export async function readRecordCluster(
  source: RecordClusterSource,
  clusterId: number,
  count: number,
): Promise<{ ids: string[]; zoom: number }> {
  const ids = new Set<string>();
  for (let offset = 0; offset < count; offset += 100) {
    const leaves = await source.getClusterLeaves(clusterId, 100, offset);
    for (const feature of leaves) {
      const id = feature.properties?.safewalkId;
      if (typeof id === 'string') ids.add(id);
    }
    if (!leaves.length)
      throw new Error('Grupo atualizado. Toque novamente para carregar os registros.');
  }
  if (ids.size !== count) throw new Error('O grupo mudou durante a consulta. Toque novamente.');
  return { ids: [...ids], zoom: await source.getClusterExpansionZoom(clusterId) };
}
export function recordGroup(ids: string[], expand: () => void): MapRecordGroup {
  return { ids: [...new Set(ids)], expand };
}
