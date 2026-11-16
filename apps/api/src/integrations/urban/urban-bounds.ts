import { z } from 'zod';

export type UrbanBounds = [number, number, number, number];
export const pilotBounds: UrbanBounds = [-46.665, -23.575, -46.635, -23.545];
/** Administrative import envelope only; it is not a municipal boundary polygon. */
export const sp156CityImportBounds: UrbanBounds = [-46.85, -24.05, -46.35, -23.35];
/** Largest live-provider area; wider map views only read locally imported points. */
export const LIVE_BOUNDS_MAX_DEGREES = 0.080001;
export const urbanBoundsSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .superRefine((bbox, context) => {
    const [west, south, east, north] = bbox;
    if (
      west >= east ||
      south >= north ||
      east - west > LIVE_BOUNDS_MAX_DEGREES ||
      north - south > LIVE_BOUNDS_MAX_DEGREES
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Aproxime o mapa: a área deve ter até 0,08 grau por dimensão.',
      });
    }
    if (west < -47.3 || east > -45.9 || south < -24.2 || north > -23.1) {
      context.addIssue({
        code: 'custom',
        message: 'Dados urbanos disponíveis nesta versão para a região de São Paulo.',
      });
    }
  });

/** Region-wide request (city view). Only imported layers answer; nothing reaches live providers. */
export const regionBoundsSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .superRefine((bbox, context) => {
    const [west, south, east, north] = bbox;
    if (west >= east || south >= north || east - west > 1.2 || north - south > 1.2) {
      context.addIssue({
        code: 'custom',
        message: 'Aproxime o mapa: a área deve ter até 1,2 grau por dimensão.',
      });
    }
    if (west < -47.3 || east > -45.9 || south < -24.2 || north > -23.1) {
      context.addIssue({
        code: 'custom',
        message: 'Dados urbanos disponíveis nesta versão para a região de São Paulo.',
      });
    }
  });
/** Regional import envelope for traffic signals: capital (GeoSampa) and neighbors (OSM). */
export const signalsRegionBounds: UrbanBounds = [-47.1, -24.1, -46.1, -23.2];

export function isWideBounds([west, south, east, north]: UrbanBounds): boolean {
  return east - west > LIVE_BOUNDS_MAX_DEGREES || north - south > LIVE_BOUNDS_MAX_DEGREES;
}

/** Wide views snap to a 0,05° grid so panning a city view reuses the same response. */
export function normalizeRegionBounds(input: UrbanBounds): UrbanBounds {
  const bbox = regionBoundsSchema.parse(input);
  if (!isWideBounds(bbox)) return normalizeUrbanBounds(bbox);
  const rounded = (number: number) => Number(number.toFixed(5));
  const [west, south, east, north] = bbox;
  return [
    rounded(Math.max(-47.3, Math.floor((west + 1e-9) / 0.05) * 0.05)),
    rounded(Math.max(-24.2, Math.floor((south + 1e-9) / 0.05) * 0.05)),
    rounded(Math.min(-45.9, Math.ceil((east - 1e-9) / 0.05) * 0.05)),
    rounded(Math.min(-23.1, Math.ceil((north - 1e-9) / 0.05) * 0.05)),
  ];
}

/** Coarsening avoids a provider call for every small pan and sending precise GPS fixes. */
export function normalizeUrbanBounds(input: UrbanBounds): UrbanBounds {
  const [west, south, east, north] = urbanBoundsSchema.parse(input);
  const rounded = (number: number) => Number(number.toFixed(5));
  return [
    rounded(Math.floor((west + 1e-9) / 0.005) * 0.005),
    rounded(Math.floor((south + 1e-9) / 0.005) * 0.005),
    rounded(Math.ceil((east - 1e-9) / 0.005) * 0.005),
    rounded(Math.ceil((north - 1e-9) / 0.005) * 0.005),
  ];
}

export function pointWithinBounds(
  longitude: number,
  latitude: number,
  [west, south, east, north]: UrbanBounds,
): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= west &&
    longitude <= east &&
    latitude >= south &&
    latitude <= north
  );
}
