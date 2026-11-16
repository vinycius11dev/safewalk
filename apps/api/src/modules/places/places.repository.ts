import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { SavedPlaceInput } from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import { AppError } from '../../middleware/errors.js';

export interface SavedPlaceRow extends RowDataPacket {
  id: string;
  kind: SavedPlaceInput['kind'];
  label: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  created_at: Date;
  updated_at: Date;
}
export interface SavedPlace {
  id: string;
  kind: SavedPlaceInput['kind'];
  label: string;
  address: string;
  location: { latitude: number; longitude: number };
  createdAt: string;
  updatedAt: string;
}
const toSavedPlace = (row: SavedPlaceRow): SavedPlace => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  address: row.address,
  location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
const PLACE_LIMIT = 6;

export async function listPlaces(userId: string): Promise<SavedPlace[]> {
  const [rows] = await pool.execute<SavedPlaceRow[]>(
    'SELECT * FROM saved_places WHERE user_id = ? ORDER BY created_at',
    [userId],
  );
  return rows.map(toSavedPlace);
}

export async function createPlace(userId: string, input: SavedPlaceInput): Promise<SavedPlace> {
  return transaction(async (db) => {
    await db.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const [counts] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM saved_places WHERE user_id = ?',
      [userId],
    );
    if (Number(counts[0]?.total) >= PLACE_LIMIT)
      throw new AppError(409, 'PLACE_LIMIT', 'Você pode salvar até 6 locais.');
    if (input.kind !== 'other') {
      const [kinds] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM saved_places WHERE user_id = ? AND kind = ? LIMIT 1',
        [userId, input.kind],
      );
      if (kinds.length)
        throw new AppError(
          409,
          'PLACE_KIND_EXISTS',
          input.kind === 'home'
            ? 'Você já tem um local salvo como Casa. Edite o existente.'
            : 'Você já tem um local salvo como Trabalho. Edite o existente.',
        );
    }
    const id = randomUUID();
    await db.execute(
      'INSERT INTO saved_places (id, user_id, kind, label, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        input.kind,
        input.label,
        input.address,
        input.location.latitude,
        input.location.longitude,
      ],
    );
    const [rows] = await db.execute<SavedPlaceRow[]>('SELECT * FROM saved_places WHERE id = ?', [
      id,
    ]);
    return toSavedPlace(rows[0]!);
  });
}

export async function updatePlace(
  userId: string,
  id: string,
  input: SavedPlaceInput,
): Promise<SavedPlace> {
  return transaction(async (db) => {
    const [rows] = await db.execute<SavedPlaceRow[]>(
      'SELECT * FROM saved_places WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId],
    );
    if (!rows[0]) throw new AppError(404, 'PLACE_NOT_FOUND', 'Local não encontrado.');
    if (input.kind !== 'other' && input.kind !== rows[0].kind) {
      const [kinds] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM saved_places WHERE user_id = ? AND kind = ? AND id <> ? LIMIT 1',
        [userId, input.kind, id],
      );
      if (kinds.length)
        throw new AppError(
          409,
          'PLACE_KIND_EXISTS',
          'Já existe um local salvo com esse tipo. Edite o existente.',
        );
    }
    await db.execute(
      'UPDATE saved_places SET kind = ?, label = ?, address = ?, latitude = ?, longitude = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND user_id = ?',
      [
        input.kind,
        input.label,
        input.address,
        input.location.latitude,
        input.location.longitude,
        id,
        userId,
      ],
    );
    const [updated] = await db.execute<SavedPlaceRow[]>('SELECT * FROM saved_places WHERE id = ?', [
      id,
    ]);
    return toSavedPlace(updated[0]!);
  });
}

export async function deletePlace(userId: string, id: string): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM saved_places WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!result.affectedRows) throw new AppError(404, 'PLACE_NOT_FOUND', 'Local não encontrado.');
}
