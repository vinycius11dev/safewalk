import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import type { RealRoute, RouteManeuver, UrbanFeature } from '@safewalk/contracts';
import type { FeatureCollection, Point } from 'geojson';
import { matchRoutePosition } from './route-guidance';

type IconName = ComponentProps<typeof Feather>['name'];
type Instruction = RealRoute['instructions'][number];

/** Semáforo considerado "à frente" até esta distância pelo trajeto. */
export const SIGNAL_LOOKAHEAD_METERS = 200;
/** Semáforo cadastrado a até esta distância da linha da rota. */
const SIGNAL_MAX_OFFSET_METERS = 30;

const maneuverIcons: Record<RouteManeuver, IconName> = {
  depart: 'navigation',
  arrive: 'flag',
  continue: 'arrow-up',
  slight_right: 'arrow-up-right',
  right: 'corner-up-right',
  sharp_right: 'corner-up-right',
  uturn: 'rotate-ccw',
  sharp_left: 'corner-up-left',
  left: 'corner-up-left',
  slight_left: 'arrow-up-left',
  roundabout: 'refresh-cw',
  stairs: 'trending-up',
  elevator: 'chevrons-up',
  other: 'navigation',
};

export function maneuverIcon(maneuver: RouteManeuver | undefined): IconName {
  return maneuverIcons[maneuver ?? 'other'];
}

/** "80 m", "120 m", "1,2 km": arredonda como os navegadores, sem falsa precisão. */
export function formatDistance(meters: number): string {
  if (meters >= 1000)
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  if (meters < 20) return 'agora';
  return `${Math.round(meters / 10) * 10} m`;
}

export type NavigationCue = {
  instruction: Instruction;
  /** Metros até a manobra; `null` sem posição GPS confiável sobre a rota. */
  distanceMeters: number | null;
};

/**
 * Próxima manobra a executar. Com GPS sobre a rota, é a instrução seguinte à etapa atual
 * e a distância até o ponto onde ela começa; sem GPS, é o início do roteiro, sem distância.
 */
export function nextNavigationCue(
  route: Pick<RealRoute, 'instructions'>,
  cumulative: readonly number[],
  currentStep: number | null,
  alongRouteMeters: number | null,
): NavigationCue | null {
  const instructions = route.instructions;
  if (!instructions.length) return null;
  if (currentStep === null || alongRouteMeters === null)
    return { instruction: instructions[0]!, distanceMeters: null };
  const next = instructions[currentStep + 1];
  if (!next) {
    const total = cumulative.at(-1) ?? alongRouteMeters;
    return {
      instruction: instructions[currentStep]!,
      distanceMeters: Math.max(0, total - alongRouteMeters),
    };
  }
  const start = cumulative[next.beginPointIndex] ?? alongRouteMeters;
  return { instruction: next, distanceMeters: Math.max(0, start - alongRouteMeters) };
}

export type SignalOnRoute = { id: string; alongRouteMeters: number };

/** Semáforos cadastrados junto à linha, ordenados pela distância desde a origem. */
export function signalsAlongRoute(
  points: RealRoute['points'],
  cumulative: number[],
  features: readonly UrbanFeature[],
): SignalOnRoute[] {
  const signals: SignalOnRoute[] = [];
  for (const feature of features) {
    if (feature.properties.type !== 'crossings') continue;
    const geometry = feature.geometry;
    const position =
      geometry.type === 'Point'
        ? geometry.coordinates
        : geometry.type === 'MultiPoint'
          ? geometry.coordinates[0]
          : undefined;
    if (!position) continue;
    const match = matchRoutePosition(
      points,
      { longitude: position[0], latitude: position[1] },
      cumulative,
    );
    if (match && match.distanceMeters <= SIGNAL_MAX_OFFSET_METERS)
      signals.push({ id: feature.id, alongRouteMeters: match.alongRouteMeters });
  }
  return signals.sort((a, b) => a.alongRouteMeters - b.alongRouteMeters);
}

/** Registro que ficou até esta distância para trás ainda aparece (GPS e esquinas oscilam). */
export const RECORD_BEHIND_TOLERANCE_METERS = 30;

/** Posição de cada registro do mapa ao longo do trajeto, calculada uma vez por rota. */
export function projectRecords(
  points: RealRoute['points'],
  cumulative: number[],
  records: FeatureCollection<Point>,
): Map<string, number> {
  const projection = new Map<string, number>();
  for (const record of records.features) {
    const [longitude, latitude] = record.geometry.coordinates;
    if (longitude === undefined || latitude === undefined) continue;
    const match = matchRoutePosition(points, { longitude, latitude }, cumulative);
    if (match) projection.set(String(record.id), match.alongRouteMeters);
  }
  return projection;
}

/**
 * Durante o trajeto, só o que ainda está à frente no caminho (como no Waze). Sem posição GPS
 * confiável sobre a rota, nada é escondido. O registro selecionado continua visível.
 */
export function recordsAhead(
  records: FeatureCollection<Point>,
  projection: ReadonlyMap<string, number>,
  alongRouteMeters: number | null,
  keepId?: string | null,
): FeatureCollection<Point> {
  if (alongRouteMeters === null) return records;
  return {
    type: 'FeatureCollection',
    features: records.features.filter((record) => {
      const id = String(record.id);
      const along = projection.get(id);
      return (
        id === keepId ||
        along === undefined ||
        along >= alongRouteMeters - RECORD_BEHIND_TOLERANCE_METERS
      );
    }),
  };
}

/** Primeiro semáforo cadastrado à frente, dentro do alcance do aviso. */
export function upcomingSignal(
  signals: readonly SignalOnRoute[],
  alongRouteMeters: number | null,
): { id: string; distanceMeters: number } | null {
  if (alongRouteMeters === null) return null;
  for (const signal of signals) {
    const distanceMeters = signal.alongRouteMeters - alongRouteMeters;
    if (distanceMeters < 5) continue;
    return distanceMeters <= SIGNAL_LOOKAHEAD_METERS ? { id: signal.id, distanceMeters } : null;
  }
  return null;
}
