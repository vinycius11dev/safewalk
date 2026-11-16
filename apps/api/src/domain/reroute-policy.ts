import type { PositionInput, RealRoute, RoutingRequest } from '@safewalk/contracts';

export const rerouteLockDurationMs = 90_000;
export const rerouteAttemptCooldownMs = 10_000;
export const rerouteSuccessCooldownMs = 30_000;

export type RerouteCooldownState = {
  lockUntil: Date | null;
  attemptedAt: Date | null;
  reroutedAt: Date | null;
};

export type RerouteBlockReason = 'in_progress' | 'success_cooldown' | 'attempt_cooldown' | null;

export function rerouteBlockReason(
  state: RerouteCooldownState,
  now = Date.now(),
): RerouteBlockReason {
  if (state.lockUntil && state.lockUntil.getTime() > now) return 'in_progress';
  if (state.reroutedAt && now - state.reroutedAt.getTime() < rerouteSuccessCooldownMs)
    return 'success_cooldown';
  if (state.attemptedAt && now - state.attemptedAt.getTime() < rerouteAttemptCooldownMs)
    return 'attempt_cooldown';
  return null;
}

export function createRerouteRequest(route: RealRoute, position: PositionInput): RoutingRequest {
  return {
    origin: {
      latitude: position.latitude,
      longitude: position.longitude,
    },
    destination: route.destination,
    destinationLabel: route.destinationLabel,
    profile: route.profile,
    preference: route.profile === 'auto' ? 'standard' : route.preference,
    ...(route.wheelchair && { wheelchair: true }),
  };
}

export function chooseRerouteOption(options: RealRoute[]): RealRoute | undefined {
  return (
    options.find((option) => option.context?.floodAssessment?.preferredAlternative) ??
    options.find((option) => option.context?.floodAssessment?.recommendation !== 'avoid') ??
    options[0]
  );
}

export async function calculateAndCommitReroute<T>(
  reservation: { lockToken: string; route: RealRoute; position: PositionInput },
  expectedRouteId: string,
  dependencies: {
    calculate: (request: RoutingRequest) => Promise<RealRoute[]>;
    commit: (lockToken: string, expectedRouteId: string, route: RealRoute) => Promise<T>;
    release: (lockToken: string) => Promise<void>;
    onNoRoute: () => Error;
  },
): Promise<T> {
  try {
    const options = await dependencies.calculate(
      createRerouteRequest(reservation.route, reservation.position),
    );
    const selected = chooseRerouteOption(options);
    if (!selected) throw dependencies.onNoRoute();
    return await dependencies.commit(reservation.lockToken, expectedRouteId, selected);
  } catch (error) {
    await dependencies.release(reservation.lockToken).catch(() => undefined);
    throw error;
  }
}
