import { z } from 'zod';
import { urbanFeatureSchema, urbanSourceSchema, urbanLayersResponseSchema } from './urban.js';

// Independent of index.ts so this module can be re-exported without a Zod initialization cycle.
export const routingCoordinatesSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const geographicBoundsSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north, 'Área de busca inválida.');
export const routingPreferenceSchema = z.enum(['standard', 'prefer_lit', 'step_free']);
/** Perfil de caminhada salvo na conta; o servidor o aplica ao calcular rotas a pé. */
export const walkingProfileSchema = z.enum(['standard', 'pcd', 'child', 'night']);
export const floodRouteAssessmentSchema = z.object({
  profile: z.enum(['pedestrian', 'auto']),
  recommendation: z.enum([
    'avoid',
    'caution',
    'history',
    'lower_known_exposure',
    'no_reported_incident',
    'unknown',
  ]),
  weatherCondition: z.enum(['raining', 'dry', 'stale', 'unknown']),
  activeIncidentCount: z.number().int().nonnegative(),
  impassableIncidentCount: z.number().int().nonnegative(),
  historicalAreaCount: z.number().int().nonnegative(),
  modeledAreaCount: z.number().int().nonnegative(),
  sourceId: z.string().nullable(),
  sourceStatus: z.enum(['available', 'stale', 'aggregate_only', 'not_configured', 'unavailable']),
  sourceAsOf: z.iso.datetime().nullable(),
  sourceFetchedAt: z.iso.datetime().nullable(),
  sourceExpiresAt: z.iso.datetime().nullable(),
  modelSourceStatus: z.enum(['available', 'stale', 'not_configured', 'unavailable']),
  modelSourceAsOf: z.iso.datetime().nullable(),
  modelSourceFetchedAt: z.iso.datetime().nullable(),
  modelSourceExpiresAt: z.iso.datetime().nullable(),
  coveragePartial: z.boolean(),
  preferredAlternative: z.boolean(),
  summary: z.string().max(500),
  evaluatedAt: z.iso.datetime(),
});
export const routeDayPeriodSchema = z.enum(['dawn', 'morning', 'afternoon', 'night']);
export const routeRecordsLevelSchema = z.enum(['few', 'some', 'many']);
/**
 * Leitura por regras dos registros conhecidos perto do percurso. Compara alternativas; não é
 * previsão nem atestado de segurança, por isso `assessment.safety` continua `not_assessed`.
 */
export const routeRecordsReadingSchema = z.object({
  method: z.literal('known_records_rules_v1'),
  level: z.union([routeRecordsLevelSchema, z.literal('insufficient')]),
  points: z.number().finite().nonnegative(),
  pointsPerKm: z.number().finite().nonnegative(),
  period: routeDayPeriodSchema,
  factors: z
    .array(
      z.object({
        kind: z.enum([
          'crime',
          'pedestrian_crash',
          'community_report',
          'flood',
          'infrastructure',
          'lighting',
        ]),
        count: z.number().int().nonnegative(),
        points: z.number().finite().nonnegative(),
        summary: z.string().max(300),
      }),
    )
    .max(6),
  highlights: z
    .array(
      z.object({
        startMeters: z.number().finite().nonnegative(),
        endMeters: z.number().finite().nonnegative(),
        level: routeRecordsLevelSchema,
        reason: z.string().max(300),
        instructionIndex: z.number().int().nonnegative().nullable(),
      }),
    )
    .max(3),
  fewestRecords: z.boolean(),
  missingData: z.array(z.string().max(200)).max(8),
  sources: z
    .array(
      z.object({
        name: z.string().max(120),
        sourceUrl: z.url(),
        importedAt: z.iso.datetime(),
      }),
    )
    .max(4),
  notice: z.string().max(500),
  evaluatedAt: z.iso.datetime(),
});
export const routingRequestSchema = z.object({
  origin: routingCoordinatesSchema,
  destination: routingCoordinatesSchema,
  destinationLabel: z.string().trim().min(2).max(200).optional(),
  profile: z.enum(['pedestrian', 'auto']).default('pedestrian'),
  preference: routingPreferenceSchema.default('standard'),
  /** Informado para este trajeto: há uma pessoa em cadeira de rodas. Só vale a pé. */
  wheelchair: z.boolean().optional(),
});
/** Manobra normalizada para desenhar a seta da navegação; ausente em rotas antigas. */
export const routeManeuverSchema = z.enum([
  'depart',
  'arrive',
  'continue',
  'slight_right',
  'right',
  'sharp_right',
  'uturn',
  'sharp_left',
  'left',
  'slight_left',
  'roundabout',
  'stairs',
  'elevator',
  'other',
]);
export const routeInstructionSchema = z.object({
  text: z.string().max(1000),
  maneuver: routeManeuverSchema.optional(),
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  beginPointIndex: z.number().int().nonnegative(),
  endPointIndex: z.number().int().nonnegative(),
});
export const realRouteSchema = z.object({
  id: z.uuid(),
  kind: z.literal('faster'),
  profile: z.enum(['pedestrian', 'auto']),
  provider: z.literal('valhalla'),
  origin: routingCoordinatesSchema,
  destination: routingCoordinatesSchema,
  destinationLabel: z.string().max(200),
  durationSeconds: z.number().finite().positive(),
  durationMinutes: z.number().int().positive(),
  distanceMeters: z.number().finite().positive(),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z
      .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
      .min(2)
      .max(30000),
  }),
  points: z.array(routingCoordinatesSchema).min(2).max(30000),
  instructions: z.array(routeInstructionSchema).max(2000),
  preference: routingPreferenceSchema.default('standard'),
  /** Perfil usado no cálculo (ritmo e tipo de caminho); ausente em rotas antigas e de carro. */
  walkingProfile: walkingProfileSchema.optional(),
  wheelchair: z.boolean().optional(),
  riskLabel: z.literal('desconhecido'),
  description: z.string().max(1000),
  simulated: z.literal(false),
  assessment: z.object({
    safety: z.literal('not_assessed'),
    accessibility: z.literal('not_assessed'),
  }),
  recordsReading: routeRecordsReadingSchema.optional(),
  context: z
    .object({
      method: z.literal('cached_features_within_50m'),
      bufferMeters: z.literal(50),
      nearbyFeatures: z
        .array(z.object({ id: z.string(), properties: urbanFeatureSchema.shape.properties }))
        .max(100),
      sources: z.array(urbanSourceSchema),
      floodAssessment: floodRouteAssessmentSchema.optional(),
      coverageWarnings: z.array(z.string()),
      checkedAt: z.iso.datetime(),
      truncated: z.boolean(),
    })
    .optional(),
  provenance: z.object({
    source: z.string(),
    sourceUrl: z.url(),
    attribution: z.string(),
    computedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    communityService: z.boolean(),
  }),
});
export const routingResponseSchema = z.object({
  status: z.literal('available'),
  options: z.array(realRouteSchema).min(1).max(4),
  notice: z.string(),
  computedAt: z.iso.datetime(),
});
export const geocodingPlaceSchema = z.object({
  id: z.string().max(200),
  name: z.string().max(300),
  address: z.string().max(1000),
  location: routingCoordinatesSchema,
  category: z.string().max(100).nullable(),
  bounds: geographicBoundsSchema.nullable(),
  provider: z.literal('photon'),
  attribution: z.string(),
});
export const geocodingResponseSchema = z.object({
  status: z.enum(['available', 'empty']),
  places: z.array(geocodingPlaceSchema).max(8),
  provider: z.literal('photon'),
  fetchedAt: z.iso.datetime(),
  cached: z.boolean(),
  notice: z.string(),
});
export type RealRoute = z.infer<typeof realRouteSchema>;
export type RouteManeuver = z.infer<typeof routeManeuverSchema>;
export type RoutingPreference = z.infer<typeof routingPreferenceSchema>;
export type WalkingProfile = z.infer<typeof walkingProfileSchema>;
export type RoutingRequest = z.infer<typeof routingRequestSchema>;
export type RoutingResponse = z.infer<typeof routingResponseSchema>;
export type FloodRouteAssessment = z.infer<typeof floodRouteAssessmentSchema>;
export type RouteDayPeriod = z.infer<typeof routeDayPeriodSchema>;
export type RouteRecordsLevel = z.infer<typeof routeRecordsLevelSchema>;
export type RouteRecordsReading = z.infer<typeof routeRecordsReadingSchema>;
export type GeocodingPlace = z.infer<typeof geocodingPlaceSchema>;
export type GeocodingResponse = z.infer<typeof geocodingResponseSchema>;

export const routeUrbanContextResponseSchema = z.object({
  routeId: z.uuid(),
  data: urbanLayersResponseSchema,
  floodAssessment: floodRouteAssessmentSchema,
  refreshing: z.boolean(),
  refreshError: z.string().nullable(),
});
export type RouteUrbanContextResponse = z.infer<typeof routeUrbanContextResponseSchema>;
