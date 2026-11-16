import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { RowDataPacket } from 'mysql2';
import { urbanFeatureSchema, type UrbanFeature } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import { streamInfosiga, type InfosigaStats } from '../../integrations/urban/infosiga-stream.js';
import type { UrbanBounds } from '../../integrations/urban/urban-bounds.js';

const bounds: UrbanBounds = [-53.3, -25.4, -44.0, -19.7];
const sourceUrl = 'https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip';
const lockName = 'safewalk:infosiga-import';

export async function saveInfosigaImport(zipPath: string, resourceId: string) {
  if (!/^[a-f0-9]{64}$/.test(resourceId)) throw new Error('INFOSIGA_RESOURCE_ID');
  const connection = await pool.getConnection();
  let locked = false;
  let begun = false;
  const id = randomUUID();
  const startedAt = new Date();
  try {
    const [lockRows] = await connection.execute<(RowDataPacket & { acquired: number | null })[]>(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName],
    );
    if (lockRows[0]?.acquired !== 1) throw new Error('INFOSIGA_IMPORT_ALREADY_RUNNING');
    locked = true;
    await connection.beginTransaction();
    begun = true;
    await connection.execute(
      `INSERT INTO urban_imports (id, source_id, resource_id, source_url, published_at,
        completed_at, expires_at, west, south, east, north, rows_scanned, relevant_rows,
        rows_without_coordinates, feature_count, truncated)
       VALUES (?, 'infosiga', ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, FALSE)`,
      [
        id,
        resourceId,
        sourceUrl,
        startedAt,
        new Date(startedAt.getTime() + 90 * 86400_000),
        ...bounds,
      ],
    );
    const stats = await streamInfosiga(zipPath, async (batch) => {
      const values: (string | number)[] = [];
      for (const feature of batch) {
        if (feature.geometry.type !== 'Point') throw new Error('INFOSIGA_INVALID_GEOMETRY');
        values.push(
          id,
          feature.properties.sourceFeatureId,
          ...feature.geometry.coordinates,
          JSON.stringify(feature),
        );
      }
      if (values.length)
        await connection.execute(
          `INSERT INTO urban_import_features (import_id, external_id, longitude, latitude, feature_json)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?)').join(',')}`,
          values,
        );
    });
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(zipPath)) hash.update(chunk);
    if (hash.digest('hex') !== resourceId) throw new Error('INFOSIGA_ZIP_CHANGED');
    const cities = Object.entries(stats.municipalities);
    for (let start = 0; start < cities.length; start += 200) {
      const batch = cities.slice(start, start + 200);
      const values: (string | number)[] = [];
      for (const [city, summary] of batch)
        values.push(id, city, summary.relevant, summary.valid, summary.missing, summary.outside);
      await connection.execute(
        `INSERT INTO infosiga_municipalities (import_id, municipality, relevant_rows,
         valid_coordinates, missing_coordinates, outside_envelope)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}`,
        values,
      );
    }
    const completedAt = new Date();
    await connection.execute(
      `UPDATE urban_imports SET rows_scanned = ?, relevant_rows = ?, rows_without_coordinates = ?,
       feature_count = ?, completed_at = ?, expires_at = ? WHERE id = ? AND source_id = 'infosiga'`,
      [
        stats.scanned,
        stats.relevant,
        stats.withoutCoordinates,
        stats.features,
        completedAt,
        new Date(completedAt.getTime() + 90 * 86400_000),
        id,
      ],
    );
    // Other sources, including SP156, are untouched; failed imports roll back to the previous batch.
    await connection.execute("DELETE FROM urban_imports WHERE source_id = 'infosiga' AND id <> ?", [
      id,
    ]);
    await connection.commit();
    begun = false;
    return { id, completedAt: completedAt.toISOString(), stats };
  } catch (error) {
    if (begun) await connection.rollback();
    throw error;
  } finally {
    if (locked)
      await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    connection.release();
  }
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

/** Compatible shape with getImportedSp156; integration decides source coverage/attribution. */
export async function getImportedInfosiga(bbox?: UrbanBounds, includeFeatures = true) {
  const [imports] = await pool.execute<ImportRow[]>(
    "SELECT * FROM urban_imports WHERE source_id = 'infosiga' ORDER BY completed_at DESC LIMIT 1",
  );
  const imported = imports[0];
  if (!imported) return null;
  if (!includeFeatures)
    return { imported, features: [] as UrbanFeature[], truncated: Boolean(imported.truncated) };
  const area = bbox ?? [imported.west, imported.south, imported.east, imported.north];
  const [rows] = await pool.execute<(RowDataPacket & { feature_json: unknown })[]>(
    `SELECT feature_json FROM urban_import_features WHERE import_id = ?
     AND longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ? LIMIT 1001`,
    [imported.id, area[0], area[2], area[1], area[3]],
  );
  return {
    imported,
    features: rows
      .slice(0, 1000)
      .map((row) =>
        urbanFeatureSchema.parse(
          typeof row.feature_json === 'string'
            ? (JSON.parse(row.feature_json) as unknown)
            : row.feature_json,
        ),
      ),
    truncated: rows.length > 1000 || Boolean(imported.truncated),
  };
}

export function municipalitySummary(stats: InfosigaStats) {
  return Object.entries(stats.municipalities)
    .map(([municipality, values]) => ({
      municipality,
      ...values,
      validCoordinatePercent: values.relevant
        ? Number(((100 * values.valid) / values.relevant).toFixed(1))
        : 0,
    }))
    .sort((a, b) => a.municipality.localeCompare(b.municipality, 'pt-BR'));
}
