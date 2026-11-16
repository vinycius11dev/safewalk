import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'node:crypto';
import { urbanFeatureSchema, type UrbanFeature } from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import type { UrbanBounds } from '../../integrations/urban/urban-bounds.js';

export interface CacheEntry {
  key: string;
  sourceId: string;
  payload: unknown | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  retryAfter: string;
  failed: boolean;
}
interface CacheRow extends RowDataPacket {
  cache_key: string;
  source_id: string;
  payload: unknown | null;
  fetched_at: Date | null;
  expires_at: Date | null;
  retry_after: Date;
  last_error: string | null;
}
function cacheEntry(row: CacheRow): CacheEntry {
  return {
    key: row.cache_key,
    sourceId: row.source_id,
    payload: typeof row.payload === 'string' ? (JSON.parse(row.payload) as unknown) : row.payload,
    fetchedAt: row.fetched_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    retryAfter: row.retry_after.toISOString(),
    failed: row.last_error !== null,
  };
}
export async function findCachedSnapshot(key: string): Promise<CacheEntry | null> {
  const [rows] = await pool.execute<CacheRow[]>(
    'SELECT * FROM urban_provider_cache WHERE cache_key = ?',
    [key],
  );
  return rows[0] ? cacheEntry(rows[0]) : null;
}
export async function saveCachedSnapshot(input: {
  key: string;
  sourceId: string;
  bbox: UrbanBounds;
  payload: unknown;
  ttlSeconds: number;
}): Promise<void> {
  const now = new Date();
  const expiry = new Date(now.getTime() + input.ttlSeconds * 1000);
  await pool.execute(
    `INSERT INTO urban_provider_cache (cache_key, source_id, west, south, east, north, payload, fetched_at, expires_at, attempted_at, retry_after, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE payload = VALUES(payload), fetched_at = VALUES(fetched_at), expires_at = VALUES(expires_at), attempted_at = VALUES(attempted_at), retry_after = VALUES(retry_after), last_error = NULL`,
    [
      input.key,
      input.sourceId,
      ...input.bbox,
      JSON.stringify(input.payload),
      now,
      expiry,
      now,
      expiry,
    ],
  );
}
export async function recordProviderFailure(
  key: string,
  sourceId: string,
  bbox: UrbanBounds,
): Promise<void> {
  const now = new Date();
  const retry = new Date(now.getTime() + 300_000);
  await pool.execute(
    `INSERT INTO urban_provider_cache (cache_key, source_id, west, south, east, north, attempted_at, retry_after, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PROVIDER_UNAVAILABLE')
    ON DUPLICATE KEY UPDATE attempted_at = VALUES(attempted_at), retry_after = VALUES(retry_after), last_error = VALUES(last_error)`,
    [key, sourceId, ...bbox, now, retry],
  );
}
export async function latestSourceSnapshots(): Promise<CacheEntry[]> {
  const [rows] = await pool.execute<CacheRow[]>(`SELECT c.* FROM urban_provider_cache c
    WHERE c.cache_key = (SELECT c2.cache_key FROM urban_provider_cache c2 WHERE c2.source_id = c.source_id ORDER BY c2.attempted_at DESC, c2.cache_key ASC LIMIT 1)`);
  return rows.map(cacheEntry);
}
export async function intersectingSnapshots(bbox: UrbanBounds): Promise<CacheEntry[]> {
  const [rows] = await pool.execute<CacheRow[]>(
    `SELECT * FROM urban_provider_cache
    WHERE west <= ? AND east >= ? AND south <= ? AND north >= ? AND payload IS NOT NULL
    ORDER BY fetched_at DESC LIMIT 40`,
    [bbox[2], bbox[0], bbox[3], bbox[1]],
  );
  return rows.map(cacheEntry);
}
interface ImportRow extends RowDataPacket {
  id: string;
  resource_id: string;
  source_url: string;
  published_at: Date | null;
  completed_at: Date;
  expires_at: Date;
  feature_count: number;
  west: number;
  south: number;
  east: number;
  north: number;
  rows_scanned: number;
  relevant_rows: number;
  rows_without_coordinates: number;
  truncated: number;
}
/** Latest completed import of a source, with its point features inside `bbox` (up to `limit`). */
export async function getImportedPoints(
  sourceId: string,
  bbox: UrbanBounds | undefined,
  includeFeatures: boolean,
  limit: number,
) {
  const [imports] = await pool.execute<ImportRow[]>(
    'SELECT * FROM urban_imports WHERE source_id = ? ORDER BY completed_at DESC LIMIT 1',
    [sourceId],
  );
  const imported = imports[0];
  if (!imported) return null;
  if (!includeFeatures)
    return { imported, features: [] as UrbanFeature[], truncated: Boolean(imported.truncated) };
  const bounds = bbox ?? [imported.west, imported.south, imported.east, imported.north];
  const [rows] = await pool.execute<(RowDataPacket & { feature_json: unknown })[]>(
    `SELECT feature_json FROM urban_import_features
    WHERE import_id = ? AND longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ? LIMIT ?`,
    // mysql2 prepared statements expect LIMIT as a string parameter.
    [imported.id, bounds[0], bounds[2], bounds[1], bounds[3], String(Math.trunc(limit) + 1)],
  );
  return {
    imported,
    features: rows
      .slice(0, limit)
      .map((row) =>
        urbanFeatureSchema.parse(
          typeof row.feature_json === 'string'
            ? (JSON.parse(row.feature_json) as unknown)
            : row.feature_json,
        ),
      ),
    truncated: rows.length > limit || Boolean(imported.truncated),
  };
}
export function getImportedSp156(bbox?: UrbanBounds, includeFeatures = true) {
  return getImportedPoints('sp156', bbox, includeFeatures, 1000);
}
export function saveSp156Import(input: Omit<ImportInput, 'sourceId'>) {
  return saveImportedPoints({ ...input, sourceId: 'sp156' });
}
type ImportInput = {
  sourceId: string;
  resourceId: string;
  sourceUrl: string;
  publishedAt: string | null;
  bbox: UrbanBounds;
  rowsScanned: number;
  relevantRows: number;
  rowsWithoutCoordinates: number;
  truncated: boolean;
  features: UrbanFeature[];
};
/** Replaces a source's import atomically; a failed import keeps the last valid batch. */
export async function saveImportedPoints(input: ImportInput) {
  const id = randomUUID();
  const completedAt = new Date();
  await transaction(async (connection) => {
    await connection.execute(
      `INSERT INTO urban_imports (id, source_id, resource_id, source_url, published_at, completed_at, expires_at, west, south, east, north, rows_scanned, relevant_rows, rows_without_coordinates, feature_count, truncated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sourceId,
        input.resourceId,
        input.sourceUrl,
        input.publishedAt ? new Date(input.publishedAt) : null,
        completedAt,
        new Date(completedAt.getTime() + 90 * 86400_000),
        ...input.bbox,
        input.rowsScanned,
        input.relevantRows,
        input.rowsWithoutCoordinates,
        input.features.length,
        input.truncated,
      ],
    );
    for (let start = 0; start < input.features.length; start += 200) {
      const values: (string | number)[] = [];
      const rows = input.features.slice(start, start + 200);
      for (const feature of rows) {
        if (feature.geometry.type !== 'Point') throw new Error('URBAN_IMPORT_NON_POINT');
        values.push(
          id,
          feature.properties.sourceFeatureId,
          ...feature.geometry.coordinates,
          JSON.stringify(feature),
        );
      }
      await connection.execute(
        `INSERT INTO urban_import_features (import_id, external_id, longitude, latitude, feature_json) VALUES ${rows.map(() => '(?, ?, ?, ?, ?)').join(',')}`,
        values,
      );
    }
    // The newly completed batch and replacement are atomic. Failed imports retain the last valid batch.
    await connection.execute('DELETE FROM urban_imports WHERE source_id = ? AND id <> ?', [
      input.sourceId,
      id,
    ]);
  });
  return { id, completedAt: completedAt.toISOString(), featureCount: input.features.length };
}
