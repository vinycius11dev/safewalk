import type { UrbanLayersResponse, RealRoute } from '@safewalk/contracts';
import { limitMapFeatures } from './map-data';

export const routeFloodTypes = new Set([
  'flood_history',
  'flood_risk',
  'flood_susceptibility',
  'floods',
]);
export function routeRain(data: UrbanLayersResponse | undefined, now: number) {
  const weather = data?.weather;
  if (!weather) return 'unknown';
  if (Date.parse(weather.expiresAt) <= now || now - Date.parse(weather.observedAt) > 3600000)
    return 'stale';
  return weather.precipitationMillimeters > 0 ||
    weather.rainMillimeters > 0 ||
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weather.weatherCode)
    ? 'raining'
    : 'dry';
}
export function routeUrbanMap(
  data: UrbanLayersResponse | undefined,
  accessible: boolean,
  now: number,
) {
  const raining = routeRain(data, now) === 'raining';
  return {
    type: 'FeatureCollection' as const,
    features: limitMapFeatures(data?.features ?? [], 300).map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        rainAttention: raining && routeFloodTypes.has(feature.properties.type),
        routeEmphasis:
          accessible &&
          ['sidewalks', 'crossings', 'accessibility'].includes(feature.properties.type),
      },
    })),
  };
}
export function liveRouteEvidence(
  route: RealRoute,
  data: UrbanLayersResponse | undefined,
): RealRoute {
  if (!data) return route;
  return {
    ...route,
    context: {
      method: 'cached_features_within_50m',
      bufferMeters: 50,
      nearbyFeatures: data.features.slice(0, 100).map(({ id, properties }) => ({ id, properties })),
      sources: data.sources,
      checkedAt: data.generatedAt,
      truncated: data.truncated,
      coverageWarnings: data.coverageWarnings,
    },
  };
}
