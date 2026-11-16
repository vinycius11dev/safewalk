import type {
  Coordinates,
  RealRoute,
  UrbanFeature,
  UrbanLayersResponse,
} from '@safewalk/contracts';
import type { MapMarker } from '@/components/map/real-map.types';
import { limitMapFeatures } from './map-data';
import { routeFloodTypes, routeRain } from './route-map-conditions';

type Point = [number, number];
function inside([x, y]: Point, ring: Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      result = !result;
  }
  return result;
}
/** A reference dot for an area, not a fabricated observation of a defect or flood. */
export function recordReference(
  feature: UrbanFeature,
  path: readonly Coordinates[],
): Coordinates | null {
  if (feature.geometry.type === 'Point') return null; // Already rendered at the source coordinate.
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [];
  const stride = Math.max(1, Math.floor(path.length / 128));
  for (let i = 0; i < path.length; i += stride) {
    const p = path[i]!;
    const point: Point = [p.longitude, p.latitude];
    if (
      polygons.some(
        (rings) => inside(point, rings[0]!) && !rings.slice(1).some((hole) => inside(point, hole)),
      )
    )
      return p;
  }
  return null;
}
export function routeRecordMarkers(
  data: UrbanLayersResponse | undefined,
  route: RealRoute | undefined,
  accessible: boolean,
  now: number,
): MapMarker[] {
  if (!data || !route) return [];
  const raining = routeRain(data, now) === 'raining';
  return limitMapFeatures(data.features, 300).flatMap((feature) => {
    const location = recordReference(feature, route.points);
    if (!location) return [];
    return [
      {
        id: `route-record:${feature.id}`,
        location,
        title: feature.properties.title,
        category: feature.properties.category,
        areaReference: true,
        recordType: feature.properties.type,
        rainAttention: raining && routeFloodTypes.has(feature.properties.type),
        routeEmphasis:
          accessible &&
          ['sidewalks', 'crossings', 'accessibility'].includes(feature.properties.type),
        description: 'Ponto de referência de uma área cadastrada que cruza o percurso.',
      },
    ];
  });
}
export const recordId = (id: string): string =>
  id.startsWith('route-record:') ? id.slice('route-record:'.length) : id;
