import type { RealRoute, UrbanFeature, UrbanLayersResponse } from '@safewalk/contracts';
import {
  scoreRouteRecords,
  type KnownRecord,
  type RecordLocation,
} from '../../domain/route-records-score.js';
import { findRouteRecords } from './route-records.repository.js';

function featurePoint(feature: UrbanFeature): RecordLocation | null {
  const { geometry } = feature;
  const coordinate =
    geometry.type === 'Point'
      ? geometry.coordinates
      : geometry.type === 'MultiPoint'
        ? geometry.coordinates[0]
        : undefined;
  return coordinate ? { longitude: coordinate[0], latitude: coordinate[1] } : null;
}

/** Soma a leitura de registros conhecidos a uma rota a pé já calculada. */
export async function withRecordsReading(
  route: RealRoute,
  data: UrbanLayersResponse | null,
  now = new Date(),
): Promise<RealRoute> {
  if (route.profile !== 'pedestrian') return route;
  const found = await findRouteRecords(route, now);
  const features = data?.features ?? [];
  const infrastructure = features.flatMap((feature): KnownRecord[] => {
    const point = feature.properties.type === 'sp156' ? featurePoint(feature) : null;
    return point ? [{ kind: 'infrastructure', ...point }] : [];
  });
  const lamps = features.flatMap((feature) => {
    const point = feature.properties.type === 'lighting' ? featurePoint(feature) : null;
    return point ? [point] : [];
  });
  return {
    ...route,
    recordsReading: scoreRouteRecords({
      route,
      records: [...found.records, ...infrastructure],
      lamps: lamps.length ? lamps : null,
      flood: route.context?.floodAssessment,
      coverage: found.coverage,
      sources: found.sources,
      now,
    }),
  };
}
