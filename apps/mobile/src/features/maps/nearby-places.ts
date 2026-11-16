import type { Coordinates, UrbanFeature } from '@safewalk/contracts';

export type NearbyKind = 'police' | 'health';
export type NearbyPlace = {
  kind: NearbyKind;
  feature: UrbanFeature;
  location: Coordinates;
  distanceMeters: number;
};

export function pointOf(feature: UrbanFeature): Coordinates | null {
  const geometry = feature.geometry;
  const position =
    geometry.type === 'Point'
      ? geometry.coordinates
      : geometry.type === 'MultiPoint'
        ? geometry.coordinates[0]
        : undefined;
  return position ? { longitude: position[0], latitude: position[1] } : null;
}

/** Straight-line distance in meters (haversine); not the walking distance. */
export function straightDistanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** The closest police station and hospital among the loaded records, in that order. */
export function nearestPlaces(
  features: Iterable<UrbanFeature>,
  origin: Coordinates,
): NearbyPlace[] {
  const best = new Map<NearbyKind, NearbyPlace>();
  for (const feature of features) {
    const kind = feature.properties.type;
    if (kind !== 'police' && kind !== 'health') continue;
    const location = pointOf(feature);
    if (!location) continue;
    const distanceMeters = straightDistanceMeters(origin, location);
    const current = best.get(kind);
    if (!current || distanceMeters < current.distanceMeters)
      best.set(kind, { kind, feature, location, distanceMeters });
  }
  return (['police', 'health'] as const).flatMap((kind) => best.get(kind) ?? []);
}

/** "350 m", "1,2 km", "12 km" — straight line, rounded without false precision. */
export function formatStraightDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: meters < 10000 ? 1 : 0 })} km`;
}

/** Place name without the layer prefix ("Delegacia · 1° DP - Liberdade" → "1° DP - Liberdade"). */
export function placeName(feature: UrbanFeature): string {
  const title = feature.properties.title;
  const separator = title.indexOf(' · ');
  return separator >= 0 ? title.slice(separator + 3) : title;
}
