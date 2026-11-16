import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import {
  mapConsentVersion,
  positionSchema,
  realRouteSchema,
  type PositionInput,
  type RealRoute,
  type RouteKind,
  type ShareLink,
  type TripStartEmailNotification,
  type Trip,
} from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { databaseNow, transaction } from '../../database/pool.js';
import { isTerminal, shareLinkExpiry } from '../../domain/trip-state.js';
import {
  SHARE_REVOKED_BY_OWNER,
  shareLinkReissueWaitSeconds,
} from '../../domain/share-link-policy.js';
import { demoRouteOptions } from '../../domain/route-options.js';
import { createShareToken, hashShareToken } from '../../domain/security.js';
import { AppError } from '../../middleware/errors.js';
import {
  ownedTrip,
  serializeTrip,
  addEvent,
  extendShareLinks,
  recordCameraRequest,
} from './trips.repository.js';
import { ownedProposal } from '../routing/routing.repository.js';
import {
  cancelPendingContactAlerts,
  enqueueContactAlerts,
} from '../contact-alerts/contact-alerts.repository.js';
import { rerouteBlockReason, rerouteLockDurationMs } from '../../domain/reroute-policy.js';

const MAX_REROUTE_POSITION_AGE_MS = 25_000;
const MAX_REROUTE_RECEIVE_AGE_MS = 20_000;
const MAX_REROUTE_POSITION_ACCURACY_METERS = 45;

export type RerouteReservation = {
  lockToken: string;
  route: RealRoute;
  position: PositionInput;
};

const jsonValue = (value: unknown): unknown =>
  typeof value === 'string' ? (JSON.parse(value) as unknown) : value;

export async function reserveReroute(
  userId: string,
  id: string,
  expectedRouteId: string,
): Promise<RerouteReservation> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (row.status !== 'active' || row.mode !== 'route')
      throw new AppError(
        409,
        'TRIP_NOT_REROUTABLE',
        'Este trajeto não está ativo para recalcular.',
      );
    if (!row.route_snapshot)
      throw new AppError(409, 'ROUTE_NOT_AVAILABLE', 'O trajeto atual não está disponível.');
    const route = realRouteSchema.parse(jsonValue(row.route_snapshot));
    if (route.id !== expectedRouteId)
      throw new AppError(
        409,
        'ROUTE_CHANGED',
        'A rota foi atualizada. Confira o caminho atual antes de tentar novamente.',
      );

    const now = (await databaseNow(db)).getTime();
    const blocked = rerouteBlockReason(
      {
        lockUntil: row.reroute_lock_until,
        attemptedAt: row.reroute_attempted_at,
        reroutedAt: row.rerouted_at,
      },
      now,
    );
    if (blocked === 'in_progress')
      throw new AppError(409, 'REROUTE_IN_PROGRESS', 'Já estamos procurando um novo caminho.');
    if (blocked === 'success_cooldown')
      throw new AppError(
        429,
        'REROUTE_COOLDOWN',
        'A rota acabou de ser atualizada. Aguarde alguns segundos antes de recalcular novamente.',
      );
    if (blocked === 'attempt_cooldown')
      throw new AppError(
        429,
        'REROUTE_COOLDOWN',
        'Aguarde alguns segundos antes de tentar outro recálculo.',
      );

    const [consents] = await db.execute<RowDataPacket[]>(
      'SELECT enabled, consent_version FROM map_consents WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    if (!consents[0]?.enabled || consents[0].consent_version !== mapConsentVersion)
      throw new AppError(
        403,
        'MAP_CONSENT_REQUIRED',
        'Autorize os serviços do mapa para recalcular o caminho.',
      );

    if (!row.last_position || !row.last_position_received_at)
      throw new AppError(
        409,
        'FRESH_LOCATION_REQUIRED',
        'Ative o compartilhamento de localização para encontrar um novo caminho.',
      );
    const positionRecord = positionSchema
      .extend({ receivedAt: positionSchema.shape.recordedAt })
      .safeParse(jsonValue(row.last_position));
    const position = positionRecord.success ? positionRecord.data : null;
    const receivedAt = position ? Date.parse(position.receivedAt) : NaN;
    const recordedAt = position ? Date.parse(position.recordedAt) : NaN;
    if (
      !position ||
      position.accuracyMeters > MAX_REROUTE_POSITION_ACCURACY_METERS ||
      !Number.isFinite(receivedAt) ||
      !Number.isFinite(recordedAt) ||
      now - receivedAt < -15_000 ||
      now - receivedAt > MAX_REROUTE_RECEIVE_AGE_MS ||
      now - row.last_position_received_at.getTime() > MAX_REROUTE_RECEIVE_AGE_MS ||
      now - recordedAt < -15_000 ||
      now - recordedAt > MAX_REROUTE_POSITION_AGE_MS
    )
      throw new AppError(
        409,
        'FRESH_LOCATION_REQUIRED',
        'Aguardando uma localização recente e precisa para recalcular.',
      );

    const lockToken = randomUUID();
    await db.execute(
      'UPDATE trips SET reroute_attempted_at = ?, reroute_lock_until = ?, reroute_lock_token = ? WHERE id = ?',
      [new Date(now), new Date(now + rerouteLockDurationMs), lockToken, id],
    );
    return {
      lockToken,
      route,
      position: {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracyMeters,
        recordedAt: position.recordedAt,
      },
    };
  });
}

export async function commitReroute(
  userId: string,
  id: string,
  lockToken: string,
  expectedRouteId: string,
  newRoute: RealRoute,
): Promise<Trip> {
  return transaction((db) =>
    commitRerouteInTransaction(db, userId, id, lockToken, expectedRouteId, newRoute),
  );
}

export async function commitRerouteInTransaction(
  db: PoolConnection,
  userId: string,
  id: string,
  lockToken: string,
  expectedRouteId: string,
  newRoute: RealRoute,
): Promise<Trip> {
  const row = await ownedTrip(userId, id, db, true);
  const now = await databaseNow(db);
  if (
    row.status !== 'active' ||
    row.mode !== 'route' ||
    row.reroute_lock_token !== lockToken ||
    !row.reroute_lock_until ||
    row.reroute_lock_until.getTime() <= now.getTime() ||
    !row.route_snapshot
  )
    throw new AppError(
      409,
      'REROUTE_RESERVATION_EXPIRED',
      'A solicitação de novo caminho expirou. Tente novamente.',
    );
  const oldRoute = realRouteSchema.parse(jsonValue(row.route_snapshot));
  if (oldRoute.id !== expectedRouteId)
    throw new AppError(409, 'ROUTE_CHANGED', 'A rota atual mudou durante o recálculo.');
  if (
    newRoute.profile !== oldRoute.profile ||
    newRoute.preference !== oldRoute.preference ||
    newRoute.destinationLabel !== oldRoute.destinationLabel ||
    newRoute.destination.latitude !== oldRoute.destination.latitude ||
    newRoute.destination.longitude !== oldRoute.destination.longitude
  )
    throw new AppError(502, 'INVALID_REROUTE', 'O provedor retornou um caminho incompatível.');
  const [consents] = await db.execute<RowDataPacket[]>(
    'SELECT enabled, consent_version FROM map_consents WHERE user_id = ? FOR UPDATE',
    [userId],
  );
  if (!consents[0]?.enabled || consents[0].consent_version !== mapConsentVersion)
    throw new AppError(
      403,
      'MAP_CONSENT_REQUIRED',
      'Autorize os serviços do mapa para continuar o trajeto.',
    );

  const expectedArrivalAt = new Date(now.getTime() + newRoute.durationSeconds * 1000);
  await db.execute(
    'UPDATE trips SET route_snapshot = ?, expected_arrival_at = ?, rerouted_at = ?, reroute_lock_until = NULL, reroute_lock_token = NULL WHERE id = ?',
    [JSON.stringify(newRoute), expectedArrivalAt, now, id],
  );
  await addEvent(db, id, 'trip_rerouted', {
    oldRouteId: oldRoute.id,
    newRouteId: newRoute.id,
    profile: newRoute.profile,
    preference: newRoute.preference,
    reason: 'gps_deviation',
  });
  return serializeTrip(await ownedTrip(userId, id, db), db);
}

export async function releaseReroute(userId: string, id: string, lockToken: string): Promise<void> {
  await transaction(async (db) => {
    await ownedTrip(userId, id, db, true);
    await db.execute(
      'UPDATE trips SET reroute_lock_until = NULL, reroute_lock_token = NULL WHERE id = ? AND user_id = ? AND reroute_lock_token = ?',
      [id, userId, lockToken],
    );
  });
}

export async function startTrip(
  userId: string,
  input: {
    routeKind: RouteKind;
    contactIds: string[];
    destination: string;
    routeId?: string;
    timerMinutes?: number;
    shareWheelchair?: boolean;
  },
): Promise<{ trip: Trip; links: ShareLink[] }> {
  return transaction(async (db) => {
    const route = input.routeId ? await ownedProposal(userId, input.routeId, db) : null;
    const mode = route ? 'route' : input.timerMinutes ? 'timer' : 'demo';
    const contactIds = [...new Set(input.contactIds)];
    for (const id of contactIds) {
      const [rows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM contacts WHERE id = ? AND user_id = ? AND accepted = TRUE',
        [id, userId],
      );
      if (!rows.length)
        throw new AppError(
          400,
          'CONTACT_NOT_ACCEPTED',
          'Selecione contatos que já aceitaram o convite.',
        );
    }
    const id = randomUUID();
    const startedAt = await databaseNow(db);
    const durationSeconds =
      route?.durationSeconds ??
      (input.timerMinutes ??
        demoRouteOptions.find((option) => option.kind === input.routeKind)?.durationMinutes ??
        17) * 60;
    const expectedArrivalAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    try {
      await db.execute(
        'INSERT INTO trips (id, user_id, active_user_id, mode, route_kind, destination, started_at, expected_arrival_at, route_snapshot, wheelchair_shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          userId,
          userId,
          mode,
          route?.kind ?? input.routeKind,
          route?.destinationLabel ?? input.destination,
          startedAt,
          expectedArrivalAt,
          route ? JSON.stringify(route) : null,
          Boolean(input.shareWheelchair && route?.wheelchair),
        ],
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      )
        throw new AppError(409, 'TRIP_ALREADY_ACTIVE', 'Você já tem um trajeto em andamento.');
      throw error;
    }
    const links: ShareLink[] = [];
    for (const contactId of contactIds) {
      await db.execute('INSERT INTO trip_contacts (trip_id, contact_id) VALUES (?, ?)', [
        id,
        contactId,
      ]);
      const token = createShareToken();
      const expiresAt = shareLinkExpiry(startedAt, expectedArrivalAt);
      await db.execute(
        'INSERT INTO share_tokens (token_hash, trip_id, contact_id, expires_at, issued_at) VALUES (?, ?, ?, ?, ?)',
        [hashShareToken(token), id, contactId, expiresAt, startedAt],
      );
      links.push({
        contactId,
        expiresAt: expiresAt.toISOString(),
        url: `${env.PUBLIC_WEB_URL}/acompanhar/${token}`,
      });
    }
    await addEvent(db, id, 'trip_started', {
      simulatedRouting: route === null,
      routingProvider: route?.provider ?? null,
      externalMessagesSent: false,
    });
    return { trip: await serializeTrip(await ownedTrip(userId, id, db), db), links };
  });
}

export async function recordTripStartEmailResults(
  userId: string,
  id: string,
  notifications: readonly TripStartEmailNotification[],
): Promise<void> {
  if (notifications.length === 0) return;
  await transaction(async (db) => {
    await ownedTrip(userId, id, db, true);
    await addEvent(db, id, 'trip_start_email_results', {
      notifications: notifications.map(({ contactId, status }) => ({ contactId, status })),
    });
  });
}

export async function savePosition(
  userId: string,
  id: string,
  position: PositionInput,
): Promise<void> {
  const recordedAt = new Date(position.recordedAt);
  await transaction(async (db) => {
    const now = await databaseNow(db);
    if (
      recordedAt.getTime() > now.getTime() + 60000 ||
      recordedAt.getTime() < now.getTime() - 10 * 60000
    )
      throw new AppError(400, 'STALE_POSITION', 'A localização está desatualizada.');
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status))
      throw new AppError(409, 'TRIP_ENDED', 'Este trajeto já foi encerrado.');
    if (row.mode !== 'demo') {
      const [consent] = await db.execute<RowDataPacket[]>(
        'SELECT enabled, consent_version FROM map_consents WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      if (!consent[0]?.enabled || consent[0].consent_version !== mapConsentVersion)
        throw new AppError(
          403,
          'MAP_CONSENT_REQUIRED',
          'O compartilhamento de localização foi interrompido. Autorize os serviços do mapa antes de continuar.',
        );
    }
    const trip = await serializeTrip(row, db);
    if (
      trip.lastPosition &&
      recordedAt.getTime() <= new Date(trip.lastPosition.recordedAt).getTime()
    )
      return;
    await db.execute(
      'INSERT INTO trip_positions (trip_id, latitude, longitude, accuracy_meters, recorded_at, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, position.latitude, position.longitude, position.accuracyMeters, recordedAt, now],
    );
    await db.execute(
      'UPDATE trips SET last_position = ?, last_position_received_at = ? WHERE id = ?',
      [JSON.stringify({ ...position, receivedAt: now.toISOString() }), now, id],
    );
  });
}

export async function pausePositionSharing(userId: string, id: string): Promise<void> {
  await transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status))
      throw new AppError(409, 'TRIP_ENDED', 'Este trajeto já foi encerrado.');
    if (row.last_position_received_at === null) return;
    await db.execute('UPDATE trips SET last_position_received_at = NULL WHERE id = ?', [id]);
    await addEvent(db, id, 'location_sharing_paused');
  });
}

export async function requestAlert(userId: string, id: string, reason: string): Promise<Trip> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status))
      throw new AppError(409, 'TRIP_ENDED', 'Este trajeto já foi encerrado.');
    if (Boolean(row.duress_disguised) && reason === 'manual') {
      await db.execute('UPDATE trips SET duress_disguised = FALSE WHERE id = ?', [id]);
      await addEvent(db, id, 'manual_sos_after_duress', { externalMessagesSent: false });
      return serializeTrip(await ownedTrip(userId, id, db), db);
    }
    if (row.status !== 'active' && !(row.status === 'checkin_pending' && reason === 'manual'))
      return serializeTrip(row, db);
    const [preferences] = await db.execute<RowDataPacket[]>(
      'SELECT response_seconds, automatic_detection, arrival_checkin FROM users WHERE id = ?',
      [userId],
    );
    const preference = preferences[0];
    if (reason !== 'manual' && reason !== 'late' && !preference?.automatic_detection)
      throw new AppError(
        409,
        'AUTOMATIC_DETECTION_DISABLED',
        'Ative a detecção automática nas preferências ou use o SOS manual.',
      );
    if (reason === 'late' && !preference?.arrival_checkin)
      throw new AppError(
        409,
        'ARRIVAL_CHECKIN_DISABLED',
        'Ative o check-in de chegada nas preferências para simular atraso.',
      );
    const responseSeconds = Number(preference?.response_seconds ?? 30);
    await db.execute('UPDATE trip_contacts SET acknowledged_at = NULL WHERE trip_id = ?', [id]);
    const now = (await databaseNow(db)).getTime();
    const manual = reason === 'manual';
    await db.execute(
      'UPDATE trips SET status = ?, alert_deadline = ?, escalation_deadline = ?, alert_reason = ? WHERE id = ?',
      [
        manual ? 'alerted' : 'checkin_pending',
        manual ? null : new Date(now + responseSeconds * 1000),
        manual ? new Date(now + 120000) : null,
        reason,
        id,
      ],
    );
    if (manual) {
      await extendShareLinks(db, id, shareLinkExpiry(new Date(now), row.expected_arrival_at));
      await recordCameraRequest(db, row, new Date(now), reason);
      await enqueueContactAlerts(db, id, reason, new Date(now));
    }
    await addEvent(db, id, manual ? 'contacts_alert_queued' : 'checkin_requested', {
      reason,
      externalMessagesSent: false,
    });
    return serializeTrip(await ownedTrip(userId, id, db), db);
  });
}

export async function finishTrip(
  userId: string,
  id: string,
  outcome: 'arrived' | 'cancelled',
  pinKind: 'primary' | 'duress' = 'primary',
): Promise<Trip> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status)) return serializeTrip(row, db);
    if (pinKind === 'duress') {
      await db.execute(
        "UPDATE trips SET status = ?, active_user_id = NULL, alert_deadline = NULL, escalation_deadline = NULL, alert_reason = 'duress', duress_at = COALESCE(duress_at, UTC_TIMESTAMP(3)), duress_disguised = FALSE WHERE id = ?",
        [outcome, id],
      );
      await db.execute(
        'UPDATE share_tokens SET expires_at = GREATEST(expires_at, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 HOUR)) WHERE trip_id = ? AND revoked_at IS NULL',
        [id],
      );
      await addEvent(db, id, 'duress_pin_used', {
        action: 'finish',
        externalMessagesSent: false,
      });
      const duressAt = await databaseNow(db);
      await recordCameraRequest(db, row, duressAt, 'duress');
      await enqueueContactAlerts(db, id, 'duress', duressAt);
      return serializeTrip(await ownedTrip(userId, id, db), db);
    }
    await cancelPendingContactAlerts(db, id);
    await db.execute(
      'UPDATE trips SET status = ?, active_user_id = NULL, alert_deadline = NULL, escalation_deadline = NULL, duress_disguised = FALSE WHERE id = ?',
      [outcome, id],
    );
    await db.execute(
      "UPDATE share_tokens SET revoked_at = UTC_TIMESTAMP(3), revoked_reason = 'trip_finished' WHERE trip_id = ? AND revoked_at IS NULL",
      [id],
    );
    await addEvent(db, id, 'trip_finished', { outcome });
    return serializeTrip(await ownedTrip(userId, id, db), db);
  });
}

export async function cancelAlert(
  userId: string,
  id: string,
  pinKind: 'primary' | 'duress' = 'primary',
): Promise<Trip> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status))
      throw new AppError(409, 'TRIP_ENDED', 'Este trajeto já foi encerrado.');
    if (pinKind === 'duress') {
      await db.execute(
        "UPDATE trips SET status = 'escalated', alert_deadline = NULL, escalation_deadline = NULL, alert_reason = 'duress', duress_at = COALESCE(duress_at, UTC_TIMESTAMP(3)), duress_disguised = TRUE, expected_arrival_at = GREATEST(expected_arrival_at, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)) WHERE id = ?",
        [id],
      );
      await db.execute('UPDATE trip_contacts SET acknowledged_at = NULL WHERE trip_id = ?', [id]);
      await addEvent(db, id, 'duress_pin_used', {
        action: 'cancel_alert',
        externalMessagesSent: false,
      });
      const duressAt = await databaseNow(db);
      await recordCameraRequest(db, row, duressAt, 'duress');
      await enqueueContactAlerts(db, id, 'duress', duressAt);
      return serializeTrip(await ownedTrip(userId, id, db), db);
    }
    if (row.status === 'active' && !row.duress_at) return serializeTrip(row, db);
    await cancelPendingContactAlerts(db, id);
    await db.execute(
      'UPDATE trips SET status = ?, alert_deadline = NULL, escalation_deadline = NULL, alert_reason = NULL, last_position_received_at = NULL, duress_at = NULL, duress_disguised = FALSE, expected_arrival_at = GREATEST(expected_arrival_at, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)) WHERE id = ?',
      ['active', id],
    );
    await db.execute('UPDATE trip_contacts SET acknowledged_at = NULL WHERE trip_id = ?', [id]);
    await addEvent(db, id, 'alert_cancelled_with_pin');
    return serializeTrip(await ownedTrip(userId, id, db), db);
  });
}

export async function createTrackingLinks(userId: string, id: string): Promise<ShareLink[]> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (isTerminal(row.status)) throw new AppError(409, 'TRIP_ENDED', 'Este trajeto já terminou.');
    const trip = await serializeTrip(row, db);
    const issuedAt = await databaseNow(db);
    const [last] = await db.execute<RowDataPacket[]>(
      'SELECT MAX(issued_at) AS last_issued_at FROM share_tokens WHERE trip_id = ?',
      [id],
    );
    const waitSeconds = shareLinkReissueWaitSeconds(
      (last[0]?.last_issued_at as Date | null | undefined) ?? null,
      issuedAt,
    );
    if (waitSeconds > 0)
      throw new AppError(
        429,
        'SHARE_LINK_RATE_LIMITED',
        `Aguarde ${waitSeconds} s para gerar novos links.`,
      );
    const links: ShareLink[] = [];
    for (const contactId of trip.contactIds) {
      const token = createShareToken();
      const expiresAt = shareLinkExpiry(issuedAt, row.expected_arrival_at);
      await db.execute(
        'INSERT INTO share_tokens (token_hash, trip_id, contact_id, expires_at, issued_at) VALUES (?, ?, ?, ?, ?)',
        [hashShareToken(token), id, contactId, expiresAt, issuedAt],
      );
      links.push({
        contactId,
        expiresAt: expiresAt.toISOString(),
        url: `${env.PUBLIC_WEB_URL}/acompanhar/${token}`,
      });
    }
    await addEvent(db, id, 'tracking_links_reissued', { contactCount: links.length });
    return links;
  });
}

/** Idempotente: sem link ativo para o contato, responde revokedLinks = 0. */
export async function revokeContactLinks(
  userId: string,
  id: string,
  contactId: string,
): Promise<{ contactId: string; revokedLinks: number }> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE share_tokens SET revoked_at = UTC_TIMESTAMP(3), revoked_reason = ? WHERE trip_id = ? AND contact_id = ? AND revoked_at IS NULL',
      [SHARE_REVOKED_BY_OWNER, row.id, contactId],
    );
    if (result.affectedRows > 0)
      await addEvent(db, id, 'tracking_link_revoked_by_owner', {
        contactId,
        revokedLinks: result.affectedRows,
      });
    return { contactId, revokedLinks: result.affectedRows };
  });
}

export async function saveTripFeedback(
  userId: string,
  id: string,
  feeling: NonNullable<Trip['feedback']>,
): Promise<Trip> {
  return transaction(async (db) => {
    const row = await ownedTrip(userId, id, db, true);
    if (!isTerminal(row.status))
      throw new AppError(409, 'TRIP_NOT_ENDED', 'Encerre o trajeto antes de avaliar.');
    if (row.feedback === feeling) return serializeTrip(row, db);
    await db.execute('UPDATE trips SET feedback = ? WHERE id = ?', [feeling, id]);
    await addEvent(db, id, 'trip_feedback_saved', { feeling });
    return serializeTrip(await ownedTrip(userId, id, db), db);
  });
}
