import type { communityReportResponseSchema } from '@safewalk/contracts';
import type { FeatureCollection, Point } from 'geojson';
import type { z } from 'zod';

export type CommunityReport = z.infer<typeof communityReportResponseSchema>;
export const COMMUNITY_RECORD_PREFIX = 'community:';

/**
 * Flood reports sent by people using SafeWalk, as map bubbles with the flood pictogram.
 * Only reports still active (not expired) are returned by the API; they are not verified.
 */
export function communityFloodRecords(
  reports: readonly CommunityReport[] | undefined,
  raining: boolean,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: (reports ?? [])
      .filter((report) => report.type === 'flood')
      .map((report) => ({
        type: 'Feature' as const,
        id: `${COMMUNITY_RECORD_PREFIX}${report.id}`,
        geometry: {
          type: 'Point' as const,
          coordinates: [report.location.longitude, report.location.latitude],
        },
        properties: {
          safewalkId: `${COMMUNITY_RECORD_PREFIX}${report.id}`,
          category: 'floods',
          icon: 'floods',
          title: 'Alagamento relatado pela comunidade',
          rainAttention: raining,
        },
      })),
  };
}

/** "há 20 min", "há 3 h", "há 2 dias": when a person reported it. */
export function reportedAgo(createdAt: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(createdAt)) / 60000));
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
