import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  realRouteSchema,
  type RealRoute,
  type RouteManeuver,
  type RoutingRequest,
  type WalkingProfile,
} from '@safewalk/contracts';
import { AppError } from '../../middleware/errors.js';
import { geographicJson } from './external-http.js';
import {
  attribution,
  communityServices,
  requireGeographicProvider,
  valhallaOrigin,
} from './providers.js';

const maneuverSchema = z.object({
  instruction: z.string().max(1000),
  type: z.number().int().nonnegative().optional(),
  time: z.number().finite().nonnegative(),
  length: z.number().finite().nonnegative(),
  begin_shape_index: z.number().int().nonnegative(),
  end_shape_index: z.number().int().nonnegative(),
  travel_mode: z.enum(['pedestrian', 'drive']),
});
const tripSchema = z.object({
  status: z.literal(0),
  units: z.literal('kilometers'),
  summary: z.object({
    time: z.number().finite().positive(),
    length: z.number().finite().positive(),
  }),
  legs: z
    .array(
      z.object({
        shape: z.string().min(2).max(200000),
        maneuvers: z.array(maneuverSchema).max(2000),
      }),
    )
    .min(1)
    .max(4),
});
const responseSchema = z.object({
  trip: tripSchema,
  alternates: z
    .array(z.object({ trip: tripSchema }))
    .max(10)
    .optional(),
});

/** Valhalla encodes coordinates with six decimal places, unlike the usual polyline5. */
export function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  function nextDelta(): number {
    let result = 0;
    let shift = 0;
    let chunk: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid polyline');
      chunk = encoded.charCodeAt(index++) - 63;
      if (chunk < 0 || chunk > 63) throw new Error('Invalid polyline');
      result += (chunk & 0x1f) * 2 ** shift;
      shift += 5;
    } while (chunk >= 0x20);
    return result % 2 ? -(Math.floor(result / 2) + 1) : result / 2;
  }
  while (index < encoded.length) {
    latitude += nextDelta();
    longitude += nextDelta();
    const coordinate: [number, number] = [longitude / 1e6, latitude / 1e6];
    if (
      Math.abs(coordinate[0]) > 180 ||
      Math.abs(coordinate[1]) > 90 ||
      coordinates.length >= 30000
    )
      throw new Error('Invalid polyline coordinates');
    coordinates.push(coordinate);
  }
  if (coordinates.length < 2) throw new Error('Incomplete polyline');
  return coordinates;
}

const preferenceNotes: Record<string, string> = {
  prefer_lit:
    ' Critério: preferir vias com iluminação cadastrada no OpenStreetMap (cobertura parcial; não garante luz acesa).',
  step_free:
    ' Critério: evitar escadas, perfil cadeira de rodas do provedor (dados do OpenStreetMap; acessibilidade não verificada).',
};

/** Ritmo de idosos e cadeirantes, cerca de 1 m/s; o provedor usa 5,1 km/h por padrão. */
export const CALM_WALKING_SPEED_KMH = 3.6;

/**
 * Opções de custo do Valhalla por perfil de caminhada salvo na conta.
 * `use_hills` perto de 0 evita ladeiras; fatores menores que 1 favorecem calçadas e caminhos
 * de pedestre, maiores evitam vielas e acessos de garagem.
 */
export const walkingProfileCosting: Partial<Record<WalkingProfile, Record<string, number>>> = {
  pcd: { walking_speed: CALM_WALKING_SPEED_KMH, use_hills: 0.1 },
  child: {
    sidewalk_factor: 0.8,
    walkway_factor: 0.8,
    alley_factor: 4,
    driveway_factor: 10,
    use_living_streets: 0.8,
  },
};

const walkingProfileNotes: Partial<Record<WalkingProfile, string>> = {
  pcd: ' Perfil idoso ou PCD: tempo estimado em ritmo calmo (3,6 km/h) e ladeiras evitadas quando há alternativa, conforme o relevo do provedor.',
  child:
    ' Perfil criança: prefere calçadas e caminhos de pedestre e evita vielas e acessos de garagem, conforme o OpenStreetMap. Travessias não verificadas.',
};

const wheelchairNote =
  ' Informado para este trajeto: pessoa em cadeira de rodas. Tempo estimado em ritmo calmo (3,6 km/h) e ladeiras evitadas quando há alternativa, conforme o relevo do provedor.';

/** Tipos de manobra do Valhalla (`valhalla::DirectionsLeg_Maneuver_Type`) agrupados por seta. */
const maneuverByValhallaType: Record<number, RouteManeuver> = {
  1: 'depart',
  2: 'depart',
  3: 'depart',
  4: 'arrive',
  5: 'arrive',
  6: 'arrive',
  7: 'continue',
  8: 'continue',
  17: 'continue',
  22: 'continue',
  25: 'continue',
  9: 'slight_right',
  18: 'slight_right',
  20: 'slight_right',
  23: 'slight_right',
  37: 'slight_right',
  10: 'right',
  11: 'sharp_right',
  12: 'uturn',
  13: 'uturn',
  14: 'sharp_left',
  15: 'left',
  16: 'slight_left',
  19: 'slight_left',
  21: 'slight_left',
  24: 'slight_left',
  38: 'slight_left',
  26: 'roundabout',
  27: 'roundabout',
  39: 'elevator',
  40: 'stairs',
  41: 'stairs',
};

export function valhallaManeuver(type: number | undefined): RouteManeuver {
  return type === undefined ? 'other' : (maneuverByValhallaType[type] ?? 'other');
}

function localizeInstruction(instruction: string): string {
  return instruction
    .replace(/\bpara the crosswalk\b/gi, 'para a faixa de pedestres')
    .replace(/\bthe crosswalk\b/gi, 'a faixa de pedestres')
    .replace(/\bem a calçada\b/gi, 'pela calçada')
    .replace(/\bTake the stairs\./gi, 'Use as escadas.');
}

export function parseValhalla(
  payload: unknown,
  input: RoutingRequest,
  computedAt = new Date(),
  walkingProfile: WalkingProfile = 'standard',
): RealRoute[] {
  const preference = input.profile === 'auto' ? 'standard' : (input.preference ?? 'standard');
  const profileNote =
    input.profile === 'auto'
      ? ''
      : input.wheelchair
        ? wheelchairNote
        : (walkingProfileNotes[walkingProfile] ?? '');
  try {
    const parsed = responseSchema.parse(payload);
    const seen = new Set<string>();
    return [parsed.trip, ...(parsed.alternates ?? []).map((value) => value.trip)]
      .slice(0, 3)
      .flatMap((trip) => {
        const coordinates: [number, number][] = [];
        const instructions: RealRoute['instructions'] = [];
        for (const leg of trip.legs) {
          const points = decodePolyline6(leg.shape);
          const offset = coordinates.length;
          coordinates.push(...points);
          for (const maneuver of leg.maneuvers) {
            if (maneuver.travel_mode !== (input.profile === 'auto' ? 'drive' : 'pedestrian'))
              throw new Error('Route travel mode does not match requested profile');
            if (
              maneuver.end_shape_index >= points.length ||
              maneuver.begin_shape_index > maneuver.end_shape_index
            )
              throw new Error('Invalid maneuver indices');
            instructions.push({
              text: localizeInstruction(maneuver.instruction),
              maneuver: valhallaManeuver(maneuver.type),
              distanceMeters: Math.round(maneuver.length * 1000),
              durationSeconds: maneuver.time,
              beginPointIndex: offset + maneuver.begin_shape_index,
              endPointIndex: offset + maneuver.end_shape_index,
            });
          }
        }
        const signature = JSON.stringify(coordinates);
        if (seen.has(signature)) return [];
        seen.add(signature);
        const nearEndpoint = (
          [longitude, latitude]: [number, number],
          expected: RoutingRequest['origin'],
        ): boolean => {
          const longitudeDistance =
            (longitude - expected.longitude) *
            111320 *
            Math.cos((expected.latitude * Math.PI) / 180);
          const latitudeDistance = (latitude - expected.latitude) * 111320;
          return Math.hypot(longitudeDistance, latitudeDistance) <= 400;
        };
        if (
          !nearEndpoint(coordinates[0]!, input.origin) ||
          !nearEndpoint(coordinates.at(-1)!, input.destination)
        )
          throw new Error('Route endpoints do not match selected places');
        return [
          realRouteSchema.parse({
            id: randomUUID(),
            kind: 'faster',
            profile: input.profile,
            provider: 'valhalla',
            origin: input.origin,
            destination: input.destination,
            destinationLabel: input.destinationLabel ?? 'Destino selecionado no mapa',
            preference,
            ...(input.profile === 'pedestrian' && { walkingProfile }),
            ...(input.wheelchair && { wheelchair: true }),
            durationSeconds: trip.summary.time,
            durationMinutes: Math.max(1, Math.ceil(trip.summary.time / 60)),
            distanceMeters: Math.round(trip.summary.length * 1000),
            geometry: { type: 'LineString', coordinates },
            points: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
            instructions,
            riskLabel: 'desconhecido',
            simulated: false,
            description:
              input.profile === 'auto'
                ? 'Trajeto de carro sobre a rede do OpenStreetMap, com restrições viárias cadastradas. Sem trânsito ao vivo ou validação de rodízio por placa.'
                : 'Trajeto a pé calculado sobre a rede do OpenStreetMap. Condições de segurança e acessibilidade ainda não verificadas.' +
                  (preferenceNotes[preference] ?? '') +
                  profileNote,
            assessment: { safety: 'not_assessed', accessibility: 'not_assessed' },
            provenance: {
              source: 'Valhalla / OpenStreetMap',
              sourceUrl: `${valhallaOrigin}/`,
              attribution,
              computedAt: computedAt.toISOString(),
              expiresAt: new Date(computedAt.getTime() + 15 * 60000).toISOString(),
              communityService: communityServices.valhalla,
            },
          }),
        ];
      });
  } catch {
    throw new AppError(
      503,
      'INVALID_ROUTING_RESPONSE',
      'O provedor não devolveu um trajeto válido para o modo escolhido. Confira a origem e o destino.',
    );
  }
}

export function buildValhallaRequest(
  input: RoutingRequest,
  walkingProfile: WalkingProfile = 'standard',
  excludePolygons: [number, number][][] = [],
): Record<string, unknown> {
  const preference = input.preference ?? 'standard';
  const request: Record<string, unknown> = {
    locations: [input.origin, input.destination].map(({ latitude, longitude }) => ({
      lat: latitude,
      lon: longitude,
    })),
    costing: input.profile,
    units: 'kilometers',
    language: 'pt-BR',
    alternates: 2,
    ...(excludePolygons.length && { exclude_polygons: excludePolygons }),
  };
  if (input.profile === 'auto') {
    request.costing_options = {
      auto: { ignore_restrictions: false, ignore_oneways: false, ignore_access: false },
    };
    return request;
  }
  // The walking criterion (stairs, lighting) and the saved profile (pace, hills, sidewalks) combine.
  const pedestrian: Record<string, unknown> = { ...walkingProfileCosting[walkingProfile] };
  if (preference === 'prefer_lit') Object.assign(pedestrian, { use_lit: 1, alley_factor: 5 });
  if (preference === 'step_free') pedestrian.type = 'wheelchair';
  if (Object.keys(pedestrian).length) request.costing_options = { pedestrian };
  return request;
}

export async function requestValhalla(
  input: RoutingRequest,
  walkingProfile: WalkingProfile = 'standard',
  excludePolygons: [number, number][][] = [],
): Promise<unknown> {
  requireGeographicProvider('valhalla');
  const url = new URL('/route', valhallaOrigin);
  url.searchParams.set(
    'json',
    JSON.stringify(buildValhallaRequest(input, walkingProfile, excludePolygons)),
  );
  return geographicJson(url);
}
