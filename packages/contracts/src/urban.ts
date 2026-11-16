import { z } from 'zod';

export const urbanLayerTypeSchema = z.enum([
  'sidewalks',
  'lighting',
  'crossings',
  'flood_history',
  'flood_risk',
  'flood_susceptibility',
  'accessibility',
  'health',
  'police',
  'sp156',
  'pedestrian_crashes',
  'floods',
  'weather',
]);
export type UrbanLayerType = z.infer<typeof urbanLayerTypeSchema>;
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const urbanGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: position }),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(position) }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position).min(2)) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(position).min(4)) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(position).min(4))),
  }),
]);
export const urbanFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().max(160),
  geometry: urbanGeometrySchema,
  properties: z.object({
    title: z.string().max(250),
    type: urbanLayerTypeSchema,
    category: z.enum(['flood', 'sidewalk', 'lighting', 'crossing', 'safe-place', 'other']),
    sourceId: z.string().max(80),
    sourceFeatureId: z.string().max(160),
    observedAt: z.iso.datetime().nullable(),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
});
export type UrbanFeature = z.infer<typeof urbanFeatureSchema>;
export const urbanSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: urbanLayerTypeSchema,
  sourceUrl: z.url(),
  attribution: z.string(),
  license: z.string(),
  status: z.enum(['available', 'stale', 'unavailable', 'not_configured']),
  confidence: z.literal('not_assessed').default('not_assessed'),
  fetchedAt: z.iso.datetime().nullable(),
  asOf: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  featureCount: z.number().int().nonnegative(),
  /** True only for a source that publishes current flood events with verified coordinates. */
  georeferencedCurrentEvents: z.boolean().optional(),
  coverage: z.string(),
  message: z.string(),
});
export type UrbanSource = z.infer<typeof urbanSourceSchema>;
export const urbanWeatherSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  observedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  precipitationMillimeters: z.number().nonnegative(),
  rainMillimeters: z.number().nonnegative(),
  intervalSeconds: z.number().positive(),
  weatherCode: z.number().int(),
  sourceUrl: z.url(),
  attribution: z.string(),
  note: z.string(),
});
export type UrbanWeather = z.infer<typeof urbanWeatherSchema>;
export const urbanFloodSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activePassableForVehicles: z.number().int().nonnegative(),
  activeImpassableForVehicles: z.number().int().nonnegative(),
  inactivePassableForVehicles: z.number().int().nonnegative(),
  inactiveImpassableForVehicles: z.number().int().nonnegative(),
  recordsWithoutCoordinates: z.number().int().nonnegative(),
  note: z.string(),
});
export const urbanLayersResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(urbanFeatureSchema),
  sources: z.array(urbanSourceSchema),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  truncated: z.boolean(),
  generatedAt: z.iso.datetime(),
  coverageWarnings: z.array(z.string()),
  weather: urbanWeatherSchema.nullable(),
  floodSummary: urbanFloodSummarySchema.nullable(),
});
export type UrbanLayersResponse = z.infer<typeof urbanLayersResponseSchema>;
export const urbanSourcesResponseSchema = z.object({
  sources: z.array(urbanSourceSchema),
  generatedAt: z.iso.datetime(),
});
