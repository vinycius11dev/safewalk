import type { Coordinates } from '@safewalk/contracts';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { MapBounds, RealMapProps } from './real-map.types';

/** FIAP Paulista is a camera reference, never a fabricated GPS position. */
export const DEFAULT_MAP_CENTER: Coordinates = { latitude: -23.5641, longitude: -46.6521 };
export const DEFAULT_MAP_ZOOM = 15.3;
/** From zoom 9.5 the view covers the capital; wider requests are clipped by the screen. */
export const URBAN_MIN_ZOOM = 9.5;
export const VIEWPORT_DEBOUNCE_MS = 700;
export const OVERLAY_SOURCE = 'safewalk-data';

export function lngLat(point: Coordinates): [number, number] {
  return [point.longitude, point.latitude];
}

function pointFeature(point: Coordinates, role: string, id: string): Feature<Point> {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: lngLat(point) },
    properties: { role },
  };
}

export function createMapData(props: RealMapProps): FeatureCollection {
  const features: Feature[] = (props.urbanFeatures?.features ?? []).map((feature) => ({
    ...feature,
    properties: { ...feature.properties, role: 'urban', safewalkId: feature.id },
  }));
  for (const [role, path] of [
    ['route', props.route],
    ['alternative', props.alternativeRoute],
  ] as const) {
    if (path && path.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: path.map(lngLat) },
        properties: { role },
      });
    }
  }
  for (const marker of props.markers ?? []) {
    const { location, ...properties } = marker;
    features.push({
      ...pointFeature(location, 'marker', marker.id),
      properties: {
        ...properties,
        role: 'marker',
        safewalkId: marker.id,
        category: marker.category ?? 'other',
      },
    });
  }
  if (props.location) features.push(pointFeature(props.location, 'location', 'device-location'));
  if (props.selectedPoint)
    features.push(pointFeature(props.selectedPoint, 'selected', 'selected-point'));
  return { type: 'FeatureCollection', features };
}

/** The renderer may replace a GeoJSON string id with an internal numeric id. */
export function interactiveFeatureId(feature: {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}): string | null {
  const id = feature.properties?.safewalkId ?? feature.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

export function routeBounds(route: readonly Coordinates[] | undefined): MapBounds | null {
  if (!route || route.length < 2) return null;
  const longitudes = route.map((point) => point.longitude);
  const latitudes = route.map((point) => point.latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}
