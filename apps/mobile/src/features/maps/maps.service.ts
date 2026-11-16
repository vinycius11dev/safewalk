import {
  mapConsentResponseSchema,
  mapConsentVersion,
  urbanLayersResponseSchema,
  urbanSourcesResponseSchema,
  geocodingResponseSchema,
  routingResponseSchema,
  routeUrbanContextResponseSchema,
  type Coordinates,
  type RoutingRequest,
  type UrbanLayerType,
} from '@safewalk/contracts';
import { apiRequest } from '@/lib/api-client';
export type MapBounds = [number, number, number, number];
export const PILOT_CENTER: Coordinates = { latitude: -23.559, longitude: -46.651 };
/** Approximate OpenStreetMap location of Av. Paulista, 1106, the FIAP campus address. */
export const FIAP_LOCATION: Coordinates = { latitude: -23.564324, longitude: -46.6527132 };
export const PILOT_BOUNDS: MapBounds = [-46.669, -23.578, -46.632, -23.539];
export const defaultUrbanLayers: UrbanLayerType[] = [
  'sidewalks',
  'lighting',
  'crossings',
  'flood_history',
  'floods',
  'sp156',
];
export const mapsService = {
  routeContext: (token: string, routeId: string, tripId?: string, signal?: AbortSignal) =>
    apiRequest(
      `/routing/routes/${routeId}/context${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ''}`,
      routeUrbanContextResponseSchema,
      { token, signal },
    ),
  consent: (token: string, signal?: AbortSignal) =>
    apiRequest('/maps/consent', mapConsentResponseSchema, { token, signal }),
  setConsent: (token: string, enabled: boolean) =>
    apiRequest('/maps/consent', mapConsentResponseSchema, {
      token,
      method: 'PUT',
      body: { enabled, version: mapConsentVersion },
    }),
  layers: (token: string, bbox: MapBounds, types: UrbanLayerType[], signal?: AbortSignal) =>
    apiRequest(
      `/urban/layers?${new URLSearchParams({ bbox: bbox.join(','), types: types.join(',') })}`,
      urbanLayersResponseSchema,
      { token, signal },
    ),
  sources: (token: string, signal?: AbortSignal) =>
    apiRequest('/urban/sources', urbanSourcesResponseSchema, { token, signal }),
  search: (token: string, q: string, signal?: AbortSignal) =>
    apiRequest(`/geocoding/search?${new URLSearchParams({ q })}`, geocodingResponseSchema, {
      token,
      signal,
    }),
  reverse: (token: string, point: Coordinates, signal?: AbortSignal) =>
    apiRequest(
      `/geocoding/reverse?${new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude) })}`,
      geocodingResponseSchema,
      { token, signal },
    ),
  routes: (token: string, body: RoutingRequest, signal?: AbortSignal) =>
    // O cálculo pode incluir um desvio dos trechos com mais registros, que é uma segunda consulta.
    apiRequest('/routing/routes', routingResponseSchema, {
      token,
      method: 'POST',
      body,
      signal,
      timeoutMs: 30000,
    }),
};
