import type { Pool, PoolConnection } from 'mysql2/promise';
import type { TrackingView } from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import { hashShareToken } from '../../domain/security.js';
import { canContactAcknowledge, shareLinkState } from '../../domain/trip-state.js';
import { demoRouteOptions } from '../../domain/route-options.js';
import { AppError } from '../../middleware/errors.js';
import { serializeTrip, addEvent, type TripRow } from '../trips/trips.repository.js';

interface SharedTripRow extends TripRow {
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
  contact_id: string;
  traveler_name: string;
  traveler_phone: string | null;
  acknowledged_at: Date | null;
}
async function sharedTrip(
  token: string,
  db: Pool | PoolConnection = pool,
  lock = false,
): Promise<SharedTripRow> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(410, 'LINK_EXPIRED', 'Este link expirou ou foi encerrado.');
  const [rows] = await db.execute<SharedTripRow[]>(
    `SELECT t.*, s.expires_at, s.revoked_at, s.revoked_reason, s.contact_id, u.name AS traveler_name, u.phone AS traveler_phone, tc.acknowledged_at FROM share_tokens s JOIN trips t ON t.id = s.trip_id JOIN users u ON u.id = t.user_id JOIN trip_contacts tc ON tc.trip_id = t.id AND tc.contact_id = s.contact_id WHERE s.token_hash = ?${lock ? ' FOR UPDATE' : ''}`,
    [hashShareToken(token)],
  );
  const row = rows[0];
  const access = row
    ? shareLinkState(
        row.expires_at,
        row.revoked_at,
        row.revoked_reason,
        row.status,
        new Date(),
        row.duress_at,
      )
    : 'expired';
  if (access === 'arrived')
    throw new AppError(
      410,
      'TRIP_ARRIVED',
      'Seu contato confirmou a chegada. O compartilhamento foi encerrado.',
    );
  if (!row || access === 'expired')
    throw new AppError(410, 'LINK_EXPIRED', 'Este link expirou ou foi encerrado.');
  return row;
}
export async function getTracking(token: string): Promise<TrackingView> {
  const row = await sharedTrip(token);
  const trip = await serializeTrip(row, pool, 'contact');
  const route =
    trip.route ??
    (row.mode === 'demo'
      ? (demoRouteOptions.find((option) => option.kind === row.route_kind) ?? null)
      : null);
  return {
    travelerName: row.traveler_name.split(' ')[0] ?? 'Seu contato',
    travelerPhone: row.traveler_phone || null,
    trip: { ...trip, contactIds: [], feedback: null },
    route,
    acknowledged: Boolean(row.acknowledged_at),
    duress: row.duress_at ? { usedAt: row.duress_at.toISOString() } : null,
    wheelchairShared: Boolean(row.wheelchair_shared),
    simulatedIntegrations: true,
  };
}
export async function acknowledgeTracking(token: string): Promise<void> {
  await transaction(async (db) => {
    const row = await sharedTrip(token, db, true);
    if (!canContactAcknowledge(row.status, row.duress_at)) {
      throw new AppError(409, 'NO_ACTIVE_ALERT', 'Não há alerta ativo para confirmar.');
    }
    await db.execute(
      'UPDATE trip_contacts SET acknowledged_at = COALESCE(acknowledged_at, UTC_TIMESTAMP(3)) WHERE trip_id = ? AND contact_id = ?',
      [row.id, row.contact_id],
    );
    if (!row.acknowledged_at) await addEvent(db, row.id, 'contact_acknowledged');
  });
}
