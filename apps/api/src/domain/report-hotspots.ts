import type { AdminHotspot, ReportType } from '@safewalk/contracts';

/** Mesma janela de "mesmo ponto" da fila (cerca de 100 m), em graus de latitude e longitude. */
export const HOTSPOT_LATITUDE_DELTA = 0.0009;
export const HOTSPOT_LONGITUDE_DELTA = 0.001;
const HOTSPOT_MIN_REPORTS = 2;
const HOTSPOT_LIMIT = 8;

export type HotspotSource = {
  type: ReportType;
  address: string;
  createdAt: string;
  location: { latitude: number; longitude: number };
};

/**
 * Agrupa relatos em aberto do mesmo tipo que ficam a ~100 m uns dos outros. Em vez de uma grade fixa
 * (que racharia um mesmo buraco entre duas células), parte do relato com mais vizinhos, junta quem
 * está ao redor e repete com o que sobrou. O ponto mostrado é a média dos relatos do grupo.
 */
export function buildHotspots(items: readonly HotspotSource[]): AdminHotspot[] {
  const near = (a: HotspotSource, b: HotspotSource) =>
    a.type === b.type &&
    Math.abs(a.location.latitude - b.location.latitude) <= HOTSPOT_LATITUDE_DELTA &&
    Math.abs(a.location.longitude - b.location.longitude) <= HOTSPOT_LONGITUDE_DELTA;
  const remaining = new Set(items);
  const spots: AdminHotspot[] = [];
  while (remaining.size >= HOTSPOT_MIN_REPORTS) {
    let seed: HotspotSource | undefined;
    let members: HotspotSource[] = [];
    for (const candidate of remaining) {
      const around = [...remaining].filter((other) => near(candidate, other));
      if (around.length > members.length) {
        seed = candidate;
        members = around;
      }
    }
    if (!seed || members.length < HOTSPOT_MIN_REPORTS) break;
    members.forEach((member) => remaining.delete(member));
    const oldest = members.reduce((first, member) =>
      Date.parse(member.createdAt) < Date.parse(first.createdAt) ? member : first,
    );
    spots.push({
      type: seed.type,
      location: {
        latitude:
          members.reduce((sum, member) => sum + member.location.latitude, 0) / members.length,
        longitude:
          members.reduce((sum, member) => sum + member.location.longitude, 0) / members.length,
      },
      count: members.length,
      address: oldest.address,
      oldestAt: oldest.createdAt,
    });
  }
  return spots
    .sort((a, b) => b.count - a.count || Date.parse(a.oldestAt) - Date.parse(b.oldestAt))
    .slice(0, HOTSPOT_LIMIT);
}
