import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../database/pool.js';
import { saoPauloBounds } from '../../domain/service-area.js';
import { streamSspCrimes } from '../../integrations/urban/ssp-crimes-stream.js';

const sourceUrl = 'https://www.ssp.sp.gov.br/estatistica/consultas';
const lockName = 'safewalk:ssp-crimes-import';
const validityMs = 120 * 86_400_000;
/** Muitos boletins na mesma coordenada exata indicam endereço genérico, não o local do fato. */
export const maximumPointsPerCoordinate = 40;

export async function saveSspCrimesImport(files: string[], resourceId: string) {
  if (!/^[a-f0-9]{64}$/.test(resourceId)) throw new Error('SSP_RESOURCE_ID');
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
    if (lockRows[0]?.acquired !== 1) throw new Error('SSP_IMPORT_ALREADY_RUNNING');
    locked = true;
    await connection.beginTransaction();
    begun = true;
    await connection.execute(
      `INSERT INTO urban_imports (id, source_id, resource_id, source_url, published_at,
        completed_at, expires_at, west, south, east, north, rows_scanned, relevant_rows,
        rows_without_coordinates, feature_count, truncated)
       VALUES (?, 'ssp-crimes', ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, FALSE)`,
      [
        id,
        resourceId.slice(0, 64),
        sourceUrl,
        startedAt,
        new Date(startedAt.getTime() + validityMs),
        ...saoPauloBounds,
      ],
    );
    const stats = await streamSspCrimes(files, async (batch) => {
      const values: (string | number | null)[] = [];
      for (const point of batch)
        values.push(
          id,
          point.externalId,
          point.longitude,
          point.latitude,
          point.category,
          point.date,
          point.period,
        );
      await connection.query(
        `INSERT INTO crime_points (import_id, external_id, longitude, latitude, category, occurred_on, period)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',')}`,
        values,
      );
    });
    const [removed] = await connection.execute<ResultSetHeader>(
      `DELETE p FROM crime_points p
       JOIN (SELECT longitude, latitude FROM crime_points WHERE import_id = ?
             GROUP BY longitude, latitude HAVING COUNT(*) > ?) repeated
         ON repeated.longitude = p.longitude AND repeated.latitude = p.latitude
       WHERE p.import_id = ?`,
      [id, String(maximumPointsPerCoordinate), id],
    );
    const completedAt = new Date();
    const featureCount = stats.features - removed.affectedRows;
    await connection.execute(
      `UPDATE urban_imports SET rows_scanned = ?, relevant_rows = ?, rows_without_coordinates = ?,
       feature_count = ?, published_at = ?, completed_at = ?, expires_at = ?
       WHERE id = ? AND source_id = 'ssp-crimes'`,
      [
        stats.scanned,
        stats.relevant,
        stats.withoutCoordinates + removed.affectedRows,
        featureCount,
        new Date(`${stats.lastDate}T12:00:00.000Z`),
        completedAt,
        new Date(completedAt.getTime() + validityMs),
        id,
      ],
    );
    await connection.execute(
      "DELETE FROM urban_imports WHERE source_id = 'ssp-crimes' AND id <> ?",
      [id],
    );
    await connection.commit();
    begun = false;
    return {
      id,
      completedAt: completedAt.toISOString(),
      stats,
      genericCoordinatesRemoved: removed.affectedRows,
      featureCount,
    };
  } catch (error) {
    if (begun) await connection.rollback();
    throw error;
  } finally {
    if (locked)
      await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    connection.release();
  }
}
