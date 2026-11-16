import { createHash } from 'node:crypto';
import {
  geocodingResponseSchema,
  type GeocodingResponse,
  type GeocodingPlace,
  type RealRoute,
  type RoutingRequest,
  type RoutingResponse,
} from '@safewalk/contracts';
import {
  searchPhoton,
  reversePhoton,
  uniquePhotonPlaces,
} from '../../integrations/routing/photon.js';
import { resolveSearchAlias, searchAlias } from '../../integrations/routing/place-aliases.js';
import { parseValhalla, requestValhalla } from '../../integrations/routing/valhalla.js';
import { requireGeographicProvider } from '../../integrations/routing/providers.js';
import { requireServiceArea, saoPauloBounds } from '../../domain/service-area.js';
import { requireRoutingDistance } from '../../domain/routing-distance.js';
import { resolveRouteRequest } from '../../domain/route-request.js';
import { AppError } from '../../middleware/errors.js';
import * as repository from './routing.repository.js';
import { getCachedUrbanContext } from '../urban-data/urban.service.js';
import { routeBounds } from './route-context.js';
import { markLowerKnownFloodExposure, withFloodAssessment } from './route-flood-assessment.js';
import { getSettings } from '../auth/settings.repository.js';
import { hotspotExclusions, markFewestRecords } from '../../domain/route-records-score.js';
import { withRecordsReading } from './route-records.service.js';

const pending = new Map<string, Promise<unknown>>();
const cacheKey = (userId: string, operation: string, input: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify([userId, operation, input]))
    .digest('hex');
async function coalesce<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = pending.get(key);
  if (previous) return previous as Promise<T>;
  const current = operation();
  pending.set(key, current);
  try {
    return await current;
  } finally {
    if (pending.get(key) === current) pending.delete(key);
  }
}
function withinBounds(
  place: GeocodingPlace,
  [west, south, east, north]: [number, number, number, number],
): boolean {
  return (
    place.location.longitude >= west &&
    place.location.longitude <= east &&
    place.location.latitude >= south &&
    place.location.latitude <= north
  );
}
async function geocode(
  userId: string,
  operation: string,
  input: unknown,
  fetchPlaces: () => Promise<GeocodingPlace[]>,
): Promise<GeocodingResponse> {
  requireGeographicProvider('photon');
  const key = cacheKey(userId, operation, input);
  return coalesce(key, async () => {
    const cached = await repository.cachedGeography(userId, key);
    if (cached) {
      const response = geocodingResponseSchema.parse(cached.payload);
      return geocodingResponseSchema.parse({
        ...response,
        places: uniquePhotonPlaces(response.places),
        cached: true,
      });
    }
    const places = await fetchPlaces();
    const result: GeocodingResponse = {
      status: places.length ? 'available' : 'empty',
      places,
      provider: 'photon',
      fetchedAt: new Date().toISOString(),
      cached: false,
      notice:
        'Endereços do OpenStreetMap via Photon. Confira rua, número e município antes de selecionar. O cadastro pode estar incompleto.',
    };
    await repository.storeGeography(userId, key, 'photon', result, 3600);
    return result;
  });
}
export async function searchPlaces(
  userId: string,
  query: string,
  bounds = saoPauloBounds,
): Promise<GeocodingResponse> {
  const [west, south, east, north] = bounds;
  if (
    west < saoPauloBounds[0] ||
    south < saoPauloBounds[1] ||
    east > saoPauloBounds[2] ||
    north > saoPauloBounds[3]
  )
    throw new AppError(
      400,
      'OUTSIDE_SERVICE_AREA',
      'A área de busca deve estar na região de São Paulo.',
    );
  return geocode(userId, 'search-v3', [query.toLocaleLowerCase('pt-BR'), bounds], async () => {
    const alias = searchAlias(query);
    const places = (await searchPhoton(alias?.providerQuery ?? query, bounds)).filter((place) =>
      withinBounds(place, bounds),
    );
    return alias ? resolveSearchAlias(places, alias.kind) : places;
  });
}
export async function reversePlace(
  userId: string,
  latitude: number,
  longitude: number,
): Promise<GeocodingResponse> {
  requireServiceArea(latitude, longitude);
  return geocode(userId, 'reverse', [latitude, longitude], async () =>
    (await reversePhoton(latitude, longitude)).filter((place) =>
      withinBounds(place, saoPauloBounds),
    ),
  );
}
const detourNote = ' Alternativa que contorna os trechos com mais registros conhecidos.';

/**
 * O provedor costuma devolver poucas alternativas. Sem comparação útil, pede uma rota que
 * contorne os trechos com mais registros; falhar aqui só mantém as opções já calculadas.
 */
async function recordsDetour(
  options: RealRoute[],
  fetchRoutes: (exclusions: [number, number][][]) => Promise<RealRoute[]>,
  assess: (route: RealRoute) => Promise<RealRoute>,
): Promise<RealRoute[]> {
  const base = options[0];
  if (!base || options.length >= 4 || markFewestRecords(options).some(hasFewestRecords)) return [];
  const exclusions = hotspotExclusions(base);
  if (!exclusions.length) return [];
  try {
    const seen = new Set(options.map((route) => JSON.stringify(route.geometry)));
    const candidates = await Promise.all(
      (await fetchRoutes(exclusions))
        .filter((route) => !seen.has(JSON.stringify(route.geometry)))
        .map((route) =>
          assess({ ...route, description: `${route.description}${detourNote}`.slice(0, 1000) }),
        ),
    );
    const pointsOf = (route: RealRoute): number => route.recordsReading?.points ?? Infinity;
    const best = [...candidates].sort((a, b) => pointsOf(a) - pointsOf(b))[0];
    return best && pointsOf(best) < pointsOf(base) ? [best] : [];
  } catch {
    return [];
  }
}

const hasFewestRecords = (route: RealRoute): boolean =>
  route.recordsReading?.fewestRecords === true;

export async function calculateRoutes(
  userId: string,
  input: RoutingRequest,
): Promise<RoutingResponse> {
  requireGeographicProvider('valhalla');
  requireServiceArea(input.origin.latitude, input.origin.longitude);
  requireServiceArea(input.destination.latitude, input.destination.longitude);
  requireRoutingDistance(input);
  const saved =
    input.profile === 'pedestrian' ? (await getSettings(userId)).walkingProfile : 'standard';
  const resolved = resolveRouteRequest(input, saved);
  input = resolved.request;
  const { walkingProfile } = resolved;
  const key = cacheKey(userId, 'route-v4', [input, walkingProfile]);
  return coalesce(key, async () => {
    const fetchPayload = async (
      request: RoutingRequest,
      exclusions: [number, number][][] = [],
    ): Promise<{ payload: unknown; computedAt: Date }> => {
      const requestKey = cacheKey(userId, 'route-v4', [request, walkingProfile, ...exclusions]);
      const cached = await repository.cachedGeography(userId, requestKey);
      const payload =
        cached?.payload ?? (await requestValhalla(request, walkingProfile, exclusions));
      // Reuse the provider computation for at most five minutes. Never refresh its actual timestamp.
      const computedAt = cached ? new Date(cached.fetchedAt) : new Date();
      if (!cached) await repository.storeGeography(userId, requestKey, 'valhalla', payload, 300);
      return { payload, computedAt };
    };
    const { payload, computedAt } = await fetchPayload(input);
    const baseOptions = parseValhalla(payload, input, computedAt, walkingProfile);
    const ranked = [...baseOptions];
    const preference = input.preference ?? 'standard';
    if (preference === 'prefer_lit') {
      const standardInput: RoutingRequest = { ...input, preference: 'standard' };
      const standard = await fetchPayload(standardInput).catch(() => null);
      if (standard) {
        const seen = new Set(ranked.map((route) => JSON.stringify(route.geometry)));
        for (const route of parseValhalla(
          standard.payload,
          standardInput,
          standard.computedAt,
          walkingProfile,
        )) {
          const signature = JSON.stringify(route.geometry);
          if (!seen.has(signature)) {
            seen.add(signature);
            ranked.push(route);
          }
        }
      }
    }
    const assess = async (route: RealRoute): Promise<RealRoute> => {
      const [west, south, east, north] = routeBounds(route);
      const bounds: [number, number, number, number] = [
        Math.max(-46.85, west),
        Math.max(-24.05, south),
        Math.min(-46.35, east),
        Math.min(-23.35, north),
      ];
      // Routing coverage is wider than urban-data coverage. Missing data must not block a route.
      const data =
        bounds[0] >= bounds[2] || bounds[1] >= bounds[3]
          ? null
          : await getCachedUrbanContext(bounds);
      return withRecordsReading(withFloodAssessment(route, data), data);
    };
    const contextualOptions = await Promise.all(ranked.slice(0, 4).map(assess));
    const detour = await recordsDetour(
      contextualOptions,
      async (exclusions) => {
        const result = await fetchPayload(input, exclusions);
        return parseValhalla(result.payload, input, result.computedAt, walkingProfile);
      },
      assess,
    );
    const options = markFewestRecords(
      markLowerKnownFloodExposure([...contextualOptions, ...detour]),
    );
    if (!options.length)
      throw new AppError(
        404,
        'PEDESTRIAN_ROUTE_NOT_FOUND',
        'Nenhum trajeto foi encontrado para o modo e locais escolhidos.',
      );
    for (const route of options) await repository.storeProposal(userId, route);
    return {
      status: 'available',
      options,
      computedAt: computedAt.toISOString(),
      notice:
        input.profile === 'auto'
          ? 'Rota de carro com sentidos, acessos e conversões cadastrados no OpenStreetMap. Sem trânsito ao vivo, interdições em tempo real ou validação de rodízio por placa. Respeite a sinalização local.'
          : 'Rotas reais a pé. As alternativas dependem do provedor. Segurança, iluminação e acessibilidade não estão verificadas em todo o percurso; ausência de registros não significa ausência de risco.',
    };
  });
}

let cleanupTimer: ReturnType<typeof setInterval> | undefined;
export function startRoutingMaintenance(): void {
  if (cleanupTimer) return;
  const cleanup = (): void => {
    void repository
      .pruneRoutingData()
      .catch(() => console.error('Não foi possível remover o cache geográfico expirado.'));
  };
  cleanup();
  cleanupTimer = setInterval(cleanup, 10 * 60000);
  cleanupTimer.unref();
}
export function stopRoutingMaintenance(): void {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
}
