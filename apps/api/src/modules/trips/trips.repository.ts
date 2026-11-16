import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { Trip, TripMode, TripStatus, RouteKind, PositionInput } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import { AppError } from '../../middleware/errors.js';
import { cameraImageRequestSchema, realRouteSchema } from '@safewalk/contracts';
import { cameraImageRequest } from '../../domain/camera-request.js';
import { routeForContact } from '../../domain/route-request.js';
import { latestContactAlertMessages } from '../contact-alerts/contact-alerts.repository.js';

export const CAMERA_REQUEST_EVENT = 'smart_sampa_image_request_simulated';

export interface TripRow extends RowDataPacket {
  id: string;
  user_id: string;
  mode: TripMode;
  route_kind: RouteKind;
  destination: string;
  status: TripStatus;
  started_at: Date;
  expected_arrival_at: Date;
  alert_deadline: Date | null;
  escalation_deadline: Date | null;
  alert_reason: Trip['alertReason'];
  feedback: Trip['feedback'];
  last_position: string | (PositionInput & { receivedAt: string }) | null;
  last_position_received_at: Date | null;
  route_snapshot: unknown;
  reroute_attempted_at: Date | null;
  reroute_lock_until: Date | null;
  reroute_lock_token: string | null;
  rerouted_at: Date | null;
  duress_at: Date | null;
  duress_disguised: number | boolean;
  wheelchair_shared: number | boolean;
}
type Executor = Pool | PoolConnection;
export async function ownedTrip(
  userId: string,
  id: string,
  db: Executor = pool,
  lock = false,
): Promise<TripRow> {
  const [rows] = await db.execute<TripRow[]>(
    `SELECT * FROM trips WHERE id = ? AND user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id, userId],
  );
  if (!rows[0]) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trajeto não encontrado.');
  return rows[0];
}
export async function serializeTrip(
  row: TripRow,
  db: Executor = pool,
  audience: 'owner' | 'contact' = 'owner',
): Promise<Trip> {
  const [contacts] = await db.execute<RowDataPacket[]>(
    'SELECT contact_id FROM trip_contacts WHERE trip_id = ?',
    [row.id],
  );
  const disguised =
    audience === 'owner' &&
    Boolean(row.duress_disguised) &&
    (row.status === 'checkin_pending' || row.status === 'alerted' || row.status === 'escalated');
  // Under coercion the owner's screen may be watched: it never shows the camera request
  // or that the contacts were e-mailed.
  const hideAlertActions = disguised || (audience === 'owner' && row.alert_reason === 'duress');
  const cameraRequest = hideAlertActions ? null : await latestCameraRequest(db, row.id);
  const alertMessages =
    hideAlertActions || audience !== 'owner' ? [] : await latestContactAlertMessages(db, row.id);
  const route = row.route_snapshot
    ? realRouteSchema.parse(
        typeof row.route_snapshot === 'string'
          ? (JSON.parse(row.route_snapshot) as unknown)
          : row.route_snapshot,
      )
    : null;
  return {
    id: row.id,
    status: disguised ? 'active' : row.status,
    mode: row.mode,
    routeKind: row.route_kind,
    destination: row.destination,
    route: route && audience === 'contact' ? routeForContact(route) : route,
    startedAt: row.started_at.toISOString(),
    expectedArrivalAt: row.expected_arrival_at.toISOString(),
    alertDeadline: disguised ? null : (row.alert_deadline?.toISOString() ?? null),
    escalationDeadline: disguised ? null : (row.escalation_deadline?.toISOString() ?? null),
    alertReason:
      disguised || (audience === 'owner' && row.alert_reason === 'duress')
        ? null
        : (row.alert_reason ?? null),
    feedback: row.feedback ?? null,
    lastPosition:
      typeof row.last_position === 'string'
        ? (JSON.parse(row.last_position) as Trip['lastPosition'])
        : row.last_position,
    contactIds: contacts.map((contact) => String(contact.contact_id)),
    cameraRequest,
    alertMessages,
  };
}
async function latestCameraRequest(db: Executor, tripId: string): Promise<Trip['cameraRequest']> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT payload FROM trip_events WHERE trip_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
    [tripId, CAMERA_REQUEST_EVENT],
  );
  const payload: unknown = rows[0]?.payload;
  if (!payload) return null;
  const parsed = cameraImageRequestSchema.safeParse(
    typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload,
  );
  return parsed.success ? parsed.data : null;
}
/** Registers the simulated Smart Sampa image request when an alert reaches the contacts. */
export async function recordCameraRequest(
  db: Executor,
  row: TripRow,
  requestedAt: Date,
  reason: string,
): Promise<void> {
  await addEvent(db, row.id, CAMERA_REQUEST_EVENT, {
    ...cameraImageRequest(requestedAt, {
      startedAt: row.started_at,
      hasLastPosition: row.last_position !== null,
      hasRoute: row.route_snapshot !== null,
    }),
    reason,
    externalRequestSent: false,
  });
}
export async function listTrips(userId: string): Promise<Trip[]> {
  const [rows] = await pool.execute<TripRow[]>(
    'SELECT * FROM trips WHERE user_id = ? ORDER BY started_at DESC LIMIT 30',
    [userId],
  );
  return Promise.all(rows.map((row) => serializeTrip(row)));
}
/** Garante que links ainda não revogados cubram o alerta que começa agora ou a nova chegada prevista. */
export async function extendShareLinks(db: Executor, tripId: string, until: Date): Promise<void> {
  await db.execute(
    'UPDATE share_tokens SET expires_at = GREATEST(expires_at, ?) WHERE trip_id = ? AND revoked_at IS NULL',
    [until, tripId],
  );
}
export async function addEvent(
  db: Executor,
  tripId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.execute('INSERT INTO trip_events (trip_id, type, payload) VALUES (?, ?, ?)', [
    tripId,
    type,
    JSON.stringify(payload),
  ]);
}
