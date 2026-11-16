import type { RoutingRequest } from '@safewalk/contracts';
import { AppError } from '../middleware/errors.js';

/** Operational caps in straight-line distance, separate from data coverage and route length. */
export function requireRoutingDistance(input: RoutingRequest): void {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((input.destination.latitude - input.origin.latitude) * radians) / 2) ** 2 +
    Math.cos(input.origin.latitude * radians) *
      Math.cos(input.destination.latitude * radians) *
      Math.sin(((input.destination.longitude - input.origin.longitude) * radians) / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (meters < 20)
    throw new AppError(
      400,
      'ROUTE_POINTS_TOO_CLOSE',
      'Origem e destino estão a menos de 20 metros. Confira se selecionou o endereço ou município correto.',
    );
  const maximumKm = input.profile === 'auto' ? 300 : 100;
  if (meters > maximumKm * 1000)
    throw new AppError(
      400,
      'ROUTE_DISTANCE_UNSUPPORTED',
      `Este serviço calcula rotas de até ${maximumKm} km em linha reta no modo ${input.profile === 'auto' ? 'carro' : 'a pé'}. Escolha locais mais próximos.`,
    );
}
