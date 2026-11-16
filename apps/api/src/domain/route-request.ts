import type { RealRoute, RoutingRequest, WalkingProfile } from '@safewalk/contracts';

/** A shared link must not reveal disability or age details that shaped the calculation. */
export function routeForContact(route: RealRoute): RealRoute {
  if (route.profile === 'auto') return route;
  const shared: RealRoute = {
    ...route,
    description:
      'Trajeto calculado sobre a rede do OpenStreetMap. Condições de segurança e acessibilidade ainda não verificadas.',
  };
  delete shared.wheelchair;
  delete shared.walkingProfile;
  // A leitura de registros orienta a escolha de quem caminha; o contato acompanha o trajeto.
  delete shared.recordsReading;
  return shared;
}

/**
 * Criteria actually used in the calculation. The walking profile comes from the account, except
 * when the traveler says this trip includes a wheelchair: then stairs and hills are avoided and
 * the pace is the calm one, whatever the account says.
 */
export function resolveRouteRequest(
  input: RoutingRequest,
  savedProfile: WalkingProfile,
): { request: RoutingRequest; walkingProfile: WalkingProfile } {
  const { wheelchair, ...base } = input;
  if (base.profile === 'auto')
    return { request: { ...base, preference: 'standard' }, walkingProfile: 'standard' };
  if (wheelchair)
    return {
      request: { ...base, preference: 'step_free', wheelchair: true },
      walkingProfile: 'pcd',
    };
  return { request: base, walkingProfile: savedProfile };
}
