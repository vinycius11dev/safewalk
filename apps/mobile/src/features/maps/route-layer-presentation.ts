import type { RealRoute, UrbanFeature, UrbanLayersResponse } from '@safewalk/contracts';
import type { FeatureCollection, Point } from 'geojson';
import { recordReference } from './route-record-markers';

export const routeCategories = [
  { id: 'signals', label: 'Semáforos', icon: 'signals' },
  { id: 'sidewalks', label: 'Calçadas', icon: 'sidewalks' },
  { id: 'police', label: 'Delegacias', icon: 'police' },
  { id: 'health', label: 'Hospitais', icon: 'health' },
  { id: 'accessibility', label: 'Acessibilidade', icon: 'accessibility' },
  { id: 'lighting', label: 'Iluminação', icon: 'lighting' },
  { id: 'floods', label: 'Inundação · histórico e áreas', icon: 'floods' },
  { id: 'reports', label: 'Solicitações em aberto', icon: 'reports' },
  { id: 'potholes', label: 'Buracos · SP156', icon: 'potholes' },
  { id: 'obstacles', label: 'Obstáculos e acessibilidade · SP156', icon: 'obstacles' },
  { id: 'brokenSidewalk', label: 'Calçadas danificadas · SP156', icon: 'brokenSidewalk' },
  { id: 'drains', label: 'Bueiros e bocas de lobo · SP156', icon: 'drains' },
  { id: 'trees', label: 'Árvores em calçadas · SP156', icon: 'trees' },
  { id: 'history', label: 'Histórico e protocolos finalizados', icon: 'history' },
  { id: 'unknown', label: 'Situação não informada', icon: 'history' },
] as const;
export type RouteCategory = (typeof routeCategories)[number]['id'];
export type RouteLayerSelection = { mode: 'auto' | 'custom' | 'all'; categories: RouteCategory[] };
export type RouteLayerContext = { accessible: boolean; night: boolean; raining: boolean };
const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
/** Use a source vertex when a nearby area does not intersect the route.
 * This is a cartographic reference, never an observation on the walking line. */
function boundaryReference(feature: UrbanFeature, route?: RealRoute) {
  const geometry = feature.geometry;
  const positions =
    geometry.type === 'Polygon'
      ? (geometry.coordinates[0] ?? [])
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.flatMap((polygon) => polygon[0] ?? [])
        : geometry.type === 'LineString'
          ? geometry.coordinates
          : geometry.type === 'MultiLineString'
            ? geometry.coordinates.flat()
            : [];
  const path = route?.points ?? [];
  const stride = Math.max(1, Math.ceil(path.length / 128));
  const vertexStride = Math.max(1, Math.ceil(positions.length / 256));
  let best: (typeof positions)[number] | undefined;
  let distance = Infinity;
  for (let vertex = 0; vertex < positions.length; vertex += vertexStride) {
    const point = positions[vertex]!;
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    if (!best) best = point;
    for (let i = 0; i < path.length; i += stride) {
      const target = path[i]!;
      const dx = (point[0] - target.longitude) * Math.cos((target.latitude * Math.PI) / 180);
      const dy = point[1] - target.latitude;
      const candidate = dx * dx + dy * dy;
      if (candidate < distance) {
        best = point;
        distance = candidate;
      }
    }
  }
  return best ? { longitude: best[0], latitude: best[1] } : null;
}
export function reportState(feature: UrbanFeature): 'open' | 'closed' | 'unknown' {
  const status = normalized(String(feature.properties.details.status ?? ''));
  if (
    /^(finalizad[ao]|concluid[ao]|encerrad[ao]|cancelad[ao]|fechad[ao]|indeferid[ao])\b/.test(
      status,
    )
  )
    return 'closed';
  if (
    /^(abert[ao]|em andamento|em atendimento|em analise|aguardando|solicitad[ao]|pendente|em execucao)\b/.test(
      status,
    )
  )
    return 'open';
  return 'unknown';
}
/** Tipo de serviço do SP156 com ícone próprio; a ordem importa (poda em "calçadas" é árvore). */
function serviceCategory(feature: UrbanFeature): RouteCategory | null {
  const { service, subject } = feature.properties.details;
  const text = normalized(
    `${typeof service === 'string' ? service : ''} ${typeof subject === 'string' ? subject : ''}`,
  );
  if (/buraco/.test(text)) return 'potholes';
  if (/arvore/.test(text)) return 'trees';
  if (/bueiro|boca de lobo|pocos? de visita/.test(text)) return 'drains';
  if (/acessibilidade|obstaculo|obstru|fiacao solta/.test(text)) return 'obstacles';
  if (/calcada/.test(text)) return 'brokenSidewalk';
  return null;
}
/** Protocolo do SP156 já finalizado; no mapa fica mais claro, pois finalizar não comprova reparo. */
export function featureIsClosed(feature: UrbanFeature): boolean {
  return feature.properties.type === 'sp156' && reportState(feature) === 'closed';
}
export function featureRouteCategory(feature: UrbanFeature): RouteCategory {
  switch (feature.properties.type) {
    case 'crossings':
      return 'signals';
    case 'sidewalks':
      return 'sidewalks';
    case 'lighting':
      return 'lighting';
    case 'health':
      return 'health';
    case 'police':
      return 'police';
    case 'accessibility':
      return 'accessibility';
    case 'floods':
    case 'flood_history':
    case 'flood_risk':
    case 'flood_susceptibility':
      return 'floods';
    case 'sp156': {
      // O tipo do serviço pede um ícone próprio, qualquer que seja a situação do protocolo.
      const service = serviceCategory(feature);
      if (service) return service;
      const state = reportState(feature);
      return state === 'closed' ? 'history' : state === 'open' ? 'reports' : 'unknown';
    }
    case 'pedestrian_crashes':
      return 'history';
    default:
      return 'unknown';
  }
}
export function isRouteNight(now: number, profile?: string): boolean {
  if (profile === 'night') return true;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour >= 18 || hour < 6;
}
export function automaticRouteCategories(context: RouteLayerContext): RouteCategory[] {
  return [
    'signals',
    'reports',
    'potholes',
    'obstacles',
    'brokenSidewalk',
    ...(context.accessible ? (['sidewalks', 'accessibility'] as const) : []),
    ...(context.night ? (['lighting'] as const) : []),
    ...(context.raining ? (['floods', 'drains'] as const) : []),
  ];
}
export function buildRoutePresentation(
  data: UrbanLayersResponse | undefined,
  route: RealRoute | undefined,
  selection: RouteLayerSelection,
  context: RouteLayerContext,
  selectedId?: string | null,
) {
  const features = [
    ...new Map((data?.features ?? []).map((feature) => [feature.id, feature])).values(),
  ];
  const enabled =
    selection.mode === 'all'
      ? routeCategories.map((c) => c.id)
      : selection.mode === 'auto'
        ? automaticRouteCategories(context)
        : selection.categories;
  const counts = Object.fromEntries(routeCategories.map((c) => [c.id, 0])) as Record<
    RouteCategory,
    number
  >;
  for (const feature of features) counts[featureRouteCategory(feature)]++;
  const visible = features.filter((feature) => enabled.includes(featureRouteCategory(feature)));
  const records: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
  for (const feature of visible) {
    const geometry = feature.geometry;
    const location =
      geometry.type === 'Point'
        ? { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] }
        : geometry.type === 'MultiPoint' && geometry.coordinates[0]
          ? { longitude: geometry.coordinates[0][0], latitude: geometry.coordinates[0][1] }
          : (route && recordReference(feature, route.points)) || boundaryReference(feature, route);
    if (!location) continue;
    const category = featureRouteCategory(feature);
    const icon = routeCategories.find((c) => c.id === category)!.icon;
    records.features.push({
      type: 'Feature',
      id: feature.id,
      geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
      properties: {
        safewalkId: feature.id,
        category,
        icon,
        title: feature.properties.title,
        rainAttention: context.raining && category === 'floods',
        closed: featureIsClosed(feature),
      },
    });
  }
  const selected = features.find((feature) => feature.id === selectedId);
  const outline = {
    type: 'FeatureCollection' as const,
    features:
      selected && !['Point', 'MultiPoint'].includes(selected.geometry.type)
        ? [
            {
              ...selected,
              properties: {
                ...selected.properties,
                rainAttention: context.raining && featureRouteCategory(selected) === 'floods',
              },
            },
          ]
        : [],
  };
  return { features, visible, enabled, counts, records, outline };
}
