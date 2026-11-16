import { z } from 'zod';
import type { Coordinates } from '@safewalk/contracts';

/** Quantos destinos recentes cada conta guarda no aparelho. */
export const RECENT_DESTINATION_LIMIT = 8;

export const recentDestinationSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(300),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  usedAt: z.iso.datetime(),
});
export type RecentDestination = z.infer<typeof recentDestinationSchema>;

/** Pontos a menos de ~11 m (4 casas decimais) contam como o mesmo destino. */
export function recentDestinationKey(location: Coordinates): string {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

export function newRecentDestination(
  label: string,
  location: Coordinates,
  usedAt: Date = new Date(),
): RecentDestination {
  return recentDestinationSchema.parse({
    key: recentDestinationKey(location),
    label: label.trim().slice(0, 300),
    location: { latitude: location.latitude, longitude: location.longitude },
    usedAt: usedAt.toISOString(),
  });
}

/** Coloca o destino no topo, sem repetir o mesmo ponto, e mantém só os mais recentes. */
export function withRecentDestination(
  list: readonly RecentDestination[],
  entry: RecentDestination,
): RecentDestination[] {
  return [entry, ...list.filter((item) => item.key !== entry.key)]
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, RECENT_DESTINATION_LIMIT);
}

/** Dados guardados no aparelho são validados ao ler; itens corrompidos são descartados. */
export function parseRecentDestinations(rows: readonly unknown[]): RecentDestination[] {
  return rows
    .map((row) => recentDestinationSchema.safeParse(row))
    .flatMap((result) => (result.success ? [result.data] : []))
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, RECENT_DESTINATION_LIMIT);
}
