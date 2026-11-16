import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { realRouteSchema, type RealRoute } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import { AppError } from '../../middleware/errors.js';

interface CacheRow extends RowDataPacket {
  payload: string | unknown;
  fetched_at: Date;
  expires_at: Date;
}
const jsonValue = (value: unknown): unknown =>
  typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
export async function cachedGeography(
  userId: string,
  key: string,
): Promise<{ payload: unknown; fetchedAt: string } | null> {
  const [rows] = await pool.execute<CacheRow[]>(
    'SELECT payload, fetched_at FROM routing_cache WHERE cache_key = ? AND user_id = ? AND expires_at > UTC_TIMESTAMP(3)',
    [key, userId],
  );
  const row = rows[0];
  return row ? { payload: jsonValue(row.payload), fetchedAt: row.fetched_at.toISOString() } : null;
}
export async function storeGeography(
  userId: string,
  key: string,
  provider: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<string> {
  const now = new Date();
  await pool.execute(
    'INSERT INTO routing_cache (cache_key,user_id,provider,payload,fetched_at,expires_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),fetched_at=VALUES(fetched_at),expires_at=VALUES(expires_at)',
    [
      key,
      userId,
      provider,
      JSON.stringify(payload),
      now,
      new Date(now.getTime() + ttlSeconds * 1000),
    ],
  );
  return now.toISOString();
}
export async function storeProposal(userId: string, route: RealRoute): Promise<void> {
  await pool.execute(
    'INSERT INTO route_proposals (id,user_id,snapshot,created_at,expires_at) VALUES (?,?,?,?,?)',
    [
      route.id,
      userId,
      JSON.stringify(route),
      new Date(route.provenance.computedAt),
      new Date(route.provenance.expiresAt),
    ],
  );
}
export async function ownedProposal(
  userId: string,
  id: string,
  db?: PoolConnection,
): Promise<RealRoute> {
  const [rows] = await (db ?? pool).execute<RowDataPacket[]>(
    'SELECT snapshot FROM route_proposals WHERE id = ? AND user_id = ? AND expires_at > UTC_TIMESTAMP(3)',
    [id, userId],
  );
  if (!rows[0])
    throw new AppError(
      409,
      'ROUTE_PROPOSAL_EXPIRED',
      'Esta opção de rota expirou ou não pertence à sua conta. Calcule o caminho novamente.',
    );
  return realRouteSchema.parse(jsonValue(rows[0].snapshot));
}
export async function pruneRoutingData(): Promise<void> {
  await pool.execute('DELETE FROM routing_cache WHERE expires_at <= UTC_TIMESTAMP(3) LIMIT 500');
  await pool.execute('DELETE FROM route_proposals WHERE expires_at <= UTC_TIMESTAMP(3) LIMIT 500');
}
