import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import {
  tripAlertReasonSchema,
  type ContactAlertMessage,
  type ContactAlertMessageStatus,
  type TripAlertReason,
} from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { databaseNow, pool, transaction } from '../../database/pool.js';
import { createShareToken, hashShareToken } from '../../domain/security.js';
import {
  CONTACT_ALERT_LEASE_MS,
  contactAlertAfterFailure,
  contactAlertDecision,
} from '../../domain/contact-alert-delivery.js';

type Executor = Pool | PoolConnection;

/**
 * Queues one alert e-mail per trip contact for the alert that starts now. Runs inside the
 * transaction that changes the trip, so the queue and the state change commit together.
 * Repeated calls for the same instant are ignored by the unique key.
 */
export async function enqueueContactAlerts(
  db: Executor,
  tripId: string,
  reason: string,
  alertStartedAt: Date,
): Promise<void> {
  await db.execute(
    `INSERT INTO contact_alert_messages (id, trip_id, contact_id, channel, reason, alert_started_at, next_attempt_at)
     SELECT UUID(), trip_id, contact_id, 'email', ?, ?, ? FROM trip_contacts WHERE trip_id = ?
     ON DUPLICATE KEY UPDATE id = id`,
    [reason, alertStartedAt, alertStartedAt, tripId],
  );
}

/** The owner ended the alert with the primary PIN: messages not yet sent are dropped. */
export async function cancelPendingContactAlerts(db: Executor, tripId: string): Promise<void> {
  await db.execute(
    "UPDATE contact_alert_messages SET status = 'cancelled', lease_until = NULL WHERE trip_id = ? AND status = 'pending'",
    [tripId],
  );
}

interface MessageRow extends RowDataPacket {
  contact_id: string;
  status: string;
  attempts: number;
  accepted_at: Date | null;
}

/** Messages of the latest alert of the trip. A message in flight is shown as pending. */
export async function latestContactAlertMessages(
  db: Executor,
  tripId: string,
): Promise<ContactAlertMessage[]> {
  const [rows] = await db.execute<MessageRow[]>(
    `SELECT contact_id, status, attempts, accepted_at FROM contact_alert_messages
     WHERE trip_id = ? AND alert_started_at = (SELECT MAX(alert_started_at) FROM contact_alert_messages WHERE trip_id = ?)
     ORDER BY contact_id`,
    [tripId, tripId],
  );
  return rows.map((row) => ({
    contactId: row.contact_id,
    channel: 'email',
    status: (row.status === 'sending' ? 'pending' : row.status) as ContactAlertMessageStatus,
    attempts: Number(row.attempts),
    acceptedAt: row.accepted_at?.toISOString() ?? null,
  }));
}

export type ClaimedContactAlert = {
  id: string;
  attempts: number;
  to: string;
  travelerName: string;
  reason: TripAlertReason;
  url: string;
  linkExpiresAt: Date;
};

interface DueRow extends RowDataPacket {
  id: string;
  trip_id: string;
  contact_id: string;
  reason: string;
  attempts: number;
}

interface TargetRow extends RowDataPacket {
  accepted: number;
  email: string | null;
  email_trip_alerts: number;
  email_trip_alerts_consented_at: Date | null;
  traveler_name: string;
  link_expires_at: Date | null;
}

/**
 * Takes due messages, settles the ones that cannot be sent and leases the others. For each
 * leased message a new tracking link is issued (only the token hash is stored), with the same
 * expiry as the contact's active link. Sending happens after this transaction commits.
 */
export async function claimDueContactAlerts(
  configured: boolean,
  options: { limit?: number; tripId?: string; dueBy?: Date } = {},
): Promise<ClaimedContactAlert[]> {
  const limit = Math.max(1, Math.trunc(options.limit ?? 10));
  return transaction(async (db) => {
    const [due] = await db.execute<DueRow[]>(
      `SELECT id, trip_id, contact_id, reason, attempts FROM contact_alert_messages
       WHERE ((status = 'pending' AND next_attempt_at <= COALESCE(?, UTC_TIMESTAMP(3)))
          OR (status = 'sending' AND lease_until <= UTC_TIMESTAMP(3)))
         ${options.tripId ? 'AND trip_id = ?' : ''}
       ORDER BY next_attempt_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`,
      [options.dueBy ?? null, ...(options.tripId ? [options.tripId] : [])],
    );
    const now = await databaseNow(db);
    const claimed: ClaimedContactAlert[] = [];
    for (const message of due) {
      const [targets] = await db.execute<TargetRow[]>(
        `SELECT c.accepted, c.email, c.email_trip_alerts, c.email_trip_alerts_consented_at, u.name AS traveler_name,
           (SELECT MAX(s.expires_at) FROM share_tokens s
             WHERE s.trip_id = tc.trip_id AND s.contact_id = tc.contact_id AND s.revoked_at IS NULL AND s.expires_at > ?) AS link_expires_at
         FROM trip_contacts tc
         JOIN contacts c ON c.id = tc.contact_id
         JOIN trips t ON t.id = tc.trip_id
         JOIN users u ON u.id = t.user_id
         WHERE tc.trip_id = ? AND tc.contact_id = ?`,
        [now, message.trip_id, message.contact_id],
      );
      const target = targets[0];
      const decision = contactAlertDecision(
        target
          ? {
              accepted: Boolean(target.accepted),
              emailTripAlerts: Boolean(
                target.email_trip_alerts && target.email_trip_alerts_consented_at,
              ),
              email: target.email,
            }
          : null,
        configured,
        target?.link_expires_at ?? null,
      );
      const reason = tripAlertReasonSchema.safeParse(message.reason);
      if (decision !== 'send' || !target?.email || !target.link_expires_at || !reason.success) {
        await db.execute(
          'UPDATE contact_alert_messages SET status = ?, lease_until = NULL WHERE id = ?',
          [decision === 'send' ? 'failed' : decision, message.id],
        );
        continue;
      }
      const token = createShareToken();
      // issued_at stays NULL: alert links do not count against the owner's reissue limit.
      await db.execute(
        'INSERT INTO share_tokens (token_hash, trip_id, contact_id, expires_at) VALUES (?, ?, ?, ?)',
        [hashShareToken(token), message.trip_id, message.contact_id, target.link_expires_at],
      );
      const attempts = Number(message.attempts) + 1;
      await db.execute(
        "UPDATE contact_alert_messages SET status = 'sending', attempts = ?, lease_until = ? WHERE id = ?",
        [attempts, new Date(now.getTime() + CONTACT_ALERT_LEASE_MS), message.id],
      );
      claimed.push({
        id: message.id,
        attempts,
        to: target.email,
        travelerName: target.traveler_name,
        reason: reason.data,
        url: `${env.PUBLIC_WEB_URL}/acompanhar/${token}`,
        linkExpiresAt: target.link_expires_at,
      });
    }
    return claimed;
  });
}

/** Records the SMTP outcome; only a message still leased by this worker is updated. */
export async function completeContactAlert(
  id: string,
  attempts: number,
  accepted: boolean,
): Promise<void> {
  if (accepted) {
    await pool.execute(
      "UPDATE contact_alert_messages SET status = 'accepted_by_relay', accepted_at = UTC_TIMESTAMP(3), lease_until = NULL WHERE id = ? AND status = 'sending'",
      [id],
    );
    return;
  }
  const next = contactAlertAfterFailure(attempts);
  await pool.execute(
    `UPDATE contact_alert_messages SET status = ?, lease_until = NULL,
       next_attempt_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)
     WHERE id = ? AND status = 'sending'`,
    [next.status, next.status === 'pending' ? Math.round(next.retryInMs / 1000) : 0, id],
  );
}
