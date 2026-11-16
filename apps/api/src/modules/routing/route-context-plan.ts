import type { RealRoute, UrbanLayersResponse } from '@safewalk/contracts';
import { saoPauloBounds } from '../../domain/service-area.js';
import { routeBounds, attachCachedContext } from './route-context.js';

export function routeContextBoxes(route: RealRoute): [number, number, number, number][] {
  const clip = ([w, s, e, n]: [number, number, number, number]): [
    number,
    number,
    number,
    number,
  ] => [
    Math.max(w, saoPauloBounds[0]),
    Math.max(s, saoPauloBounds[1]),
    Math.min(e, saoPauloBounds[2]),
    Math.min(n, saoPauloBounds[3]),
  ];
  const bounds = clip(routeBounds(route));
  if (bounds[2] - bounds[0] <= 0.07 && bounds[3] - bounds[1] <= 0.07) return [bounds];
  // Bound external work on long journeys. Intermediate gaps remain explicitly partial.
  return [0, Math.floor(route.points.length / 2), route.points.length - 1].map((index) => {
    const p = route.points[index]!;
    return clip([p.longitude - 0.02, p.latitude - 0.02, p.longitude + 0.02, p.latitude + 0.02]);
  });
}

export function filterRouteContext(
  route: RealRoute,
  data: UrbanLayersResponse,
): UrbanLayersResponse {
  // Small point records must not be starved by complex flood polygons under the CPU cap.
  const ordered = [...data.features].sort(
    (a, b) => Number(b.geometry.type === 'Point') - Number(a.geometry.type === 'Point'),
  );
  const context = attachCachedContext(route, { ...data, features: ordered }, 400).context!;
  const ids = new Set(context.nearbyFeatures.map((feature) => feature.id));
  return {
    ...data,
    features: data.features.filter((feature) => ids.has(feature.id)),
    truncated: context.truncated,
    coverageWarnings: context.coverageWarnings,
  };
}
