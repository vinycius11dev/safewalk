import { AppError } from '../middleware/errors.js';

// Regional routing/search envelope; urban datasets retain their own coverage boundaries.
export const saoPauloBounds: [number, number, number, number] = [-47.3, -24.2, -45.9, -23.1];

export function requireServiceArea(latitude: number, longitude: number): void {
  const [west, south, east, north] = saoPauloBounds;
  if (latitude < south || latitude > north || longitude < west || longitude > east)
    throw new AppError(
      400,
      'OUTSIDE_SERVICE_AREA',
      'Nesta versão, selecione locais na região de São Paulo.',
    );
}
