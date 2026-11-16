import type { PositionInput, RouteKind, StartedTripResponse, Trip } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errors.js';
import { findUserById } from '../auth/auth.repository.js';
import { verifyTripPin } from '../auth/auth.service.js';
import { getSettings } from '../auth/settings.repository.js';
import { calculateRoutes } from '../routing/routing.service.js';
import { sendTripStartEmails } from '../contacts/trip-start-emails.js';
import * as repository from './trips-write.repository.js';
import { calculateAndCommitReroute } from '../../domain/reroute-policy.js';

export async function startTrip(
  userId: string,
  input: {
    routeKind: RouteKind;
    contactIds: string[];
    destination: string;
    routeId?: string;
    timerMinutes?: number;
    adultAccompanying?: boolean;
    shareWheelchair?: boolean;
  },
): Promise<StartedTripResponse> {
  if (!input.routeId && !input.timerMinutes && env.DEMO_MODE !== 'true')
    throw new AppError(
      503,
      'ROUTING_UNAVAILABLE',
      'O serviço de rotas ainda está em configuração.',
    );
  if (!(await findUserById(userId))?.pin_hash)
    throw new AppError(409, 'PIN_REQUIRED', 'Configure seu PIN de segurança antes de sair.');
  // The app must not encourage children to walk alone: the child profile needs an adult's word.
  if ((await getSettings(userId)).walkingProfile === 'child' && input.adultAccompanying !== true)
    throw new AppError(
      409,
      'ADULT_COMPANION_REQUIRED',
      'No perfil criança, o trajeto só começa com um adulto responsável acompanhando. Confirme antes de iniciar.',
    );
  const started = await repository.startTrip(userId, input);
  const emailNotifications = await sendTripStartEmails(userId, input.contactIds, started.links);
  await repository
    .recordTripStartEmailResults(userId, started.trip.id, emailNotifications)
    .catch(() => undefined);
  return {
    ...started,
    trip: {
      ...started.trip,
      route: started.trip.route ?? null,
      cameraRequest: started.trip.cameraRequest ?? null,
      alertMessages: started.trip.alertMessages ?? [],
    },
    emailNotifications,
  };
}
export const savePosition = (userId: string, id: string, input: PositionInput): Promise<void> =>
  repository.savePosition(userId, id, input);

export async function rerouteTrip(
  userId: string,
  id: string,
  expectedRouteId: string,
): Promise<Trip> {
  const reservation = await repository.reserveReroute(userId, id, expectedRouteId);
  return calculateAndCommitReroute(reservation, expectedRouteId, {
    calculate: async (request) => (await calculateRoutes(userId, request)).options,
    commit: (lockToken, currentRouteId, route) =>
      repository.commitReroute(userId, id, lockToken, currentRouteId, route),
    release: (lockToken) => repository.releaseReroute(userId, id, lockToken),
    onNoRoute: () =>
      new AppError(502, 'REROUTE_UNAVAILABLE', 'Não foi encontrado outro caminho agora.'),
  });
}
export const pausePositionSharing = (userId: string, id: string): Promise<void> =>
  repository.pausePositionSharing(userId, id);
export const requestAlert = (userId: string, id: string, reason: string): Promise<Trip> =>
  repository.requestAlert(userId, id, reason);
export async function finishTrip(
  userId: string,
  id: string,
  pin: string,
  outcome: 'arrived' | 'cancelled',
): Promise<Trip> {
  const pinKind = await verifyTripPin(userId, pin);
  return repository.finishTrip(userId, id, outcome, pinKind);
}
export async function cancelAlert(userId: string, id: string, pin: string): Promise<Trip> {
  const pinKind = await verifyTripPin(userId, pin);
  return repository.cancelAlert(userId, id, pinKind);
}
export const saveTripFeedback = (
  userId: string,
  id: string,
  feeling: NonNullable<Trip['feedback']>,
): Promise<Trip> => repository.saveTripFeedback(userId, id, feeling);
