import * as SQLite from 'expo-sqlite';
import {
  parseRecentDestinations,
  RECENT_DESTINATION_LIMIT,
  type RecentDestination,
} from './recent-destinations';

/**
 * Banco local (SQLite) do aparelho. Guarda só os destinos recentes de cada conta, para a busca
 * mostrá-los na hora, mesmo sem internet. Conta, trajetos e contatos ficam no MariaDB da API.
 */
const DATABASE_NAME = 'safewalk-local.db';
const SCHEMA_VERSION = 1;

type Row = {
  place_key: string;
  label: string;
  latitude: number;
  longitude: number;
  used_at: string;
};

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((current?.user_version ?? 0) >= SCHEMA_VERSION) return;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS recent_destinations (
      owner_id TEXT NOT NULL,
      place_key TEXT NOT NULL,
      label TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      used_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, place_key)
    );
    CREATE INDEX IF NOT EXISTS recent_destinations_owner_used
      ON recent_destinations (owner_id, used_at DESC);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

function database(): Promise<SQLite.SQLiteDatabase> {
  opening ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await migrate(db);
    return db;
  });
  // Se abrir falhar, a próxima chamada tenta de novo em vez de repetir o erro para sempre.
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

export async function listRecentDestinations(ownerId: string): Promise<RecentDestination[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>(
    `SELECT place_key, label, latitude, longitude, used_at FROM recent_destinations
      WHERE owner_id = $owner ORDER BY used_at DESC LIMIT $limit`,
    { $owner: ownerId, $limit: RECENT_DESTINATION_LIMIT },
  );
  return parseRecentDestinations(
    rows.map((row) => ({
      key: row.place_key,
      label: row.label,
      location: { latitude: row.latitude, longitude: row.longitude },
      usedAt: row.used_at,
    })),
  );
}

export async function saveRecentDestination(ownerId: string, entry: RecentDestination) {
  const db = await database();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO recent_destinations (owner_id, place_key, label, latitude, longitude, used_at)
         VALUES ($owner, $key, $label, $latitude, $longitude, $usedAt)
       ON CONFLICT (owner_id, place_key)
         DO UPDATE SET label = excluded.label, used_at = excluded.used_at`,
      {
        $owner: ownerId,
        $key: entry.key,
        $label: entry.label,
        $latitude: entry.location.latitude,
        $longitude: entry.location.longitude,
        $usedAt: entry.usedAt,
      },
    );
    await tx.runAsync(
      `DELETE FROM recent_destinations WHERE owner_id = $owner AND place_key NOT IN (
         SELECT place_key FROM recent_destinations WHERE owner_id = $owner
          ORDER BY used_at DESC LIMIT $limit)`,
      { $owner: ownerId, $limit: RECENT_DESTINATION_LIMIT },
    );
  });
}

export async function removeRecentDestination(ownerId: string, key: string) {
  const db = await database();
  await db.runAsync(
    'DELETE FROM recent_destinations WHERE owner_id = $owner AND place_key = $key',
    {
      $owner: ownerId,
      $key: key,
    },
  );
}

/** Sem ownerId apaga os destinos de todas as contas do aparelho (ao sair ou excluir a conta). */
export async function clearRecentDestinations(ownerId?: string) {
  const db = await database();
  if (ownerId)
    await db.runAsync('DELETE FROM recent_destinations WHERE owner_id = $owner', {
      $owner: ownerId,
    });
  else await db.runAsync('DELETE FROM recent_destinations');
}
