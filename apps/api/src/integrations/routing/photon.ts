import { z } from 'zod';
import { geocodingPlaceSchema, type GeocodingPlace } from '@safewalk/contracts';
import { AppError } from '../../middleware/errors.js';
import { geographicJson } from './external-http.js';
import { attribution, photonOrigin, requireGeographicProvider } from './providers.js';

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  properties: z.object({
    osm_type: z.string(),
    osm_id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postcode: z.string().optional(),
    osm_value: z.string().optional(),
    extent: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  }),
});
const collectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(featureSchema).max(100),
});

export function parsePhoton(payload: unknown): GeocodingPlace[] {
  const parsed = collectionSchema.safeParse(payload);
  if (!parsed.success)
    throw new AppError(
      503,
      'INVALID_GEOCODING_RESPONSE',
      'O provedor devolveu endereços em um formato inválido.',
    );
  const places = parsed.data.features.slice(0, 8).map((feature) => {
    const p = feature.properties;
    const extent = p.extent;
    const bounds = extent
      ? [
          Math.min(extent[0], extent[2]),
          Math.min(extent[1], extent[3]),
          Math.max(extent[0], extent[2]),
          Math.max(extent[1], extent[3]),
        ]
      : null;
    const street = [p.street, p.housenumber].filter(Boolean).join(', ');
    // O país fica de fora: a busca é limitada à região de São Paulo e o Photon o devolve em inglês.
    return {
      id: `photon:${p.osm_type}:${p.osm_id}`,
      name: (p.name || street || p.city || 'Local no mapa').slice(0, 300),
      address: [
        ...new Set([p.name, street, p.district, p.city, p.state, p.postcode].filter(Boolean)),
      ]
        .join(' · ')
        .slice(0, 1000),
      location: {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      },
      category: p.osm_value?.slice(0, 100) ?? null,
      bounds,
      provider: 'photon',
      attribution: `${attribution} · Photon / komoot`,
    };
  });
  const normalized = z.array(geocodingPlaceSchema).safeParse(places);
  if (!normalized.success)
    throw new AppError(
      503,
      'INVALID_GEOCODING_RESPONSE',
      'O provedor devolveu endereços em um formato inválido.',
    );
  return uniquePhotonPlaces(normalized.data);
}

/** Photon can emit the same OSM object more than once when it has several categories. */
export function uniquePhotonPlaces(places: readonly GeocodingPlace[]): GeocodingPlace[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

export async function searchPhoton(
  query: string,
  bounds: [number, number, number, number],
): Promise<GeocodingPlace[]> {
  requireGeographicProvider('photon');
  const url = new URL('/api/', photonOrigin);
  url.search = new URLSearchParams({ q: query, limit: '6', bbox: bounds.join(',') }).toString();
  return parsePhoton(await geographicJson(url));
}
export async function reversePhoton(
  latitude: number,
  longitude: number,
): Promise<GeocodingPlace[]> {
  requireGeographicProvider('photon');
  const url = new URL('/reverse', photonOrigin);
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    limit: '1',
    radius: '0.25',
  }).toString();
  return parsePhoton(await geographicJson(url));
}
