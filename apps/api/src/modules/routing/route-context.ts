import type { RealRoute, UrbanFeature, UrbanLayersResponse } from '@safewalk/contracts';

type Point = [number, number];
type Segment = [Point, Point];
const longitudeMeters = 111320 * Math.cos((-23.55 * Math.PI) / 180);
const project = ([longitude, latitude]: Point): Point => [
  longitude * longitudeMeters,
  latitude * 111320,
];
const squaredDistance = ([x, y]: Point, [a, b]: Segment): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const fraction =
    dx || dy
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
      : 0;
  return (x - a[0] - fraction * dx) ** 2 + (y - a[1] - fraction * dy) ** 2;
};
function intersects([a, b]: Segment, [c, d]: Segment): boolean {
  const cross = (p: Point, q: Point, r: Point): number =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
function inside(point: Point, ring: Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
function geometryLines(feature: UrbanFeature): { lines: Point[][]; polygons: Point[][][] } {
  const g = feature.geometry;
  switch (g.type) {
    case 'Point':
      return { lines: [[g.coordinates]], polygons: [] };
    case 'MultiPoint':
      return { lines: g.coordinates.map((point) => [point]), polygons: [] };
    case 'LineString':
      return { lines: [g.coordinates], polygons: [] };
    case 'MultiLineString':
      return { lines: g.coordinates, polygons: [] };
    case 'Polygon':
      return { lines: g.coordinates, polygons: [g.coordinates] };
    case 'MultiPolygon':
      return { lines: g.coordinates.flat(), polygons: g.coordinates };
  }
}
export function routeBounds(route: RealRoute): [number, number, number, number] {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const [longitude, latitude] of route.geometry.coordinates) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [
    west - 50 / longitudeMeters,
    south - 50 / 111320,
    east + 50 / longitudeMeters,
    north + 50 / 111320,
  ];
}
/** Context only: proximity is approximate and never changes the pedestrian engine or risk classification. */
export function attachCachedContext(
  route: RealRoute,
  context: UrbanLayersResponse,
  limit = 100,
): RealRoute {
  const points = route.geometry.coordinates.map(project);
  const segments: Segment[] = points.slice(1).map((point, index) => [points[index]!, point]);
  const bufferSquared = 50 ** 2;
  const features: NonNullable<RealRoute['context']>['nearbyFeatures'] = [];
  let comparisons = 0;
  const maxComparisons = 2_000_000;
  const [west, south, east, north] = routeBounds(route);
  for (const feature of context.features) {
    if (features.length >= limit || comparisons >= maxComparisons) break;
    const { lines, polygons } = geometryLines(feature);
    const vertices = lines.flat();
    let featureWest = 180;
    let featureEast = -180;
    let featureSouth = 90;
    let featureNorth = -90;
    for (const [x, y] of vertices) {
      featureWest = Math.min(featureWest, x);
      featureEast = Math.max(featureEast, x);
      featureSouth = Math.min(featureSouth, y);
      featureNorth = Math.max(featureNorth, y);
    }
    if (featureEast < west || featureWest > east || featureNorth < south || featureSouth > north)
      continue;
    let near = false;
    for (const polygon of polygons) {
      const rings = polygon.map((ring) => ring.map(project));
      for (const point of points) {
        comparisons += rings.reduce((total, ring) => total + ring.length, 0);
        if (comparisons >= maxComparisons) break;
        if (inside(point, rings[0]!) && !rings.slice(1).some((hole) => inside(point, hole))) {
          near = true;
          break;
        }
      }
      if (near || comparisons >= maxComparisons) break;
    }
    for (const line of lines) {
      if (near || comparisons >= maxComparisons) break;
      const projected = line.map(project);
      for (let i = 0; i < projected.length && !near && comparisons < maxComparisons; i++) {
        const a = projected[i]!;
        const b = projected[i + 1];
        for (const segment of segments) {
          if (++comparisons >= maxComparisons) break;
          if (
            squaredDistance(a, segment) <= bufferSquared ||
            (b &&
              (intersects([a, b], segment) ||
                squaredDistance(b, segment) <= bufferSquared ||
                squaredDistance(segment[0], [a, b]) <= bufferSquared ||
                squaredDistance(segment[1], [a, b]) <= bufferSquared))
          ) {
            near = true;
            break;
          }
        }
      }
    }
    if (near) features.push({ id: feature.id, properties: feature.properties });
  }
  return {
    ...route,
    context: {
      method: 'cached_features_within_50m',
      bufferMeters: 50,
      nearbyFeatures: features,
      sources: context.sources,
      checkedAt: new Date().toISOString(),
      truncated: true,
      coverageWarnings: [
        ...new Set([
          ...context.coverageWarnings,
          'Contexto parcial dos dados já consultados no mapa, em uma faixa aproximada de 50 metros. Não valida as condições atuais nem muda o trajeto calculado.',
          'Registros históricos de alagamento e dimensões cadastrais de calçadas não comprovam obstáculos ativos, segurança ou acessibilidade. Ausência de registros não significa ausência de risco.',
          ...(comparisons >= maxComparisons || features.length >= limit
            ? ['Parte dos registros não foi analisada por limite de processamento.']
            : []),
        ]),
      ],
    },
  };
}
