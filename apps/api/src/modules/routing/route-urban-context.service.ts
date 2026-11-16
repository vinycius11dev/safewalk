import {
  realRouteSchema,
  type RealRoute,
  type RouteUrbanContextResponse,
} from '@safewalk/contracts';
import { ownedProposal } from './routing.repository.js';
import { ownedTrip } from '../trips/trips.repository.js';
import { getCachedUrbanContext, getUrbanLayers } from '../urban-data/urban.service.js';
import { filterRouteContext, routeContextBoxes } from './route-context-plan.js';
import { routeBounds } from './route-context.js';
import { withFloodAssessment } from './route-flood-assessment.js';
import { AppError } from '../../middleware/errors.js';

type Refresh = { startedAt: number; running: boolean; error: string | null };
const refreshes = new Map<string, Refresh>();

export async function getRouteUrbanContext(
  userId: string,
  id: string,
  tripId?: string,
): Promise<RouteUrbanContextResponse> {
  let route: RealRoute;
  if (tripId) {
    const trip = await ownedTrip(userId, tripId);
    route = realRouteSchema.parse(
      typeof trip.route_snapshot === 'string'
        ? JSON.parse(trip.route_snapshot)
        : trip.route_snapshot,
    );
    if (route.id !== id)
      throw new AppError(404, 'ROUTE_NOT_FOUND', 'Rota não encontrada neste trajeto.');
  } else route = await ownedProposal(userId, id);
  const key = `${userId}:${id}`;
  let refresh = refreshes.get(key);
  if (!refresh || (!refresh.running && Date.now() - refresh.startedAt > 120000)) {
    refresh = { startedAt: Date.now(), running: true, error: null };
    refreshes.set(key, refresh);
    const state = refresh;
    const boxes = routeContextBoxes(route);
    // Return stored real data immediately; refresh in bounded batches instead of blocking routing.
    void Promise.all(
      boxes.map((bbox) =>
        getUrbanLayers({
          bbox,
          types: [
            'sidewalks',
            'crossings',
            'lighting',
            'accessibility',
            'health',
            'sp156',
            'flood_history',
            'flood_risk',
            'flood_susceptibility',
            'weather',
            'floods',
          ],
        }),
      ),
    )
      .catch(() => {
        state.error = 'Não foi possível atualizar todas as fontes do percurso. Tente novamente.';
      })
      .finally(() => {
        state.running = false;
      });
    // Bounded bookkeeping; cached source data remains in MySQL.
    if (refreshes.size > 200)
      for (const [entry, value] of refreshes) {
        if (!value.running && entry !== key) {
          refreshes.delete(entry);
          break;
        }
      }
  }
  const data = filterRouteContext(route, await getCachedUrbanContext(routeBounds(route)));
  const assessedRoute = withFloodAssessment(route, data);
  data.coverageWarnings.push(
    'Consultas da rota têm cobertura parcial. Percursos longos consultam origem, região intermediária e destino.',
  );
  return {
    routeId: id,
    data,
    floodAssessment: assessedRoute.context!.floodAssessment!,
    refreshing: refresh.running,
    refreshError: refresh.error,
  };
}
