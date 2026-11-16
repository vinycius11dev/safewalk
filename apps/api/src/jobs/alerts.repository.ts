import type { RowDataPacket } from 'mysql2';
import { databaseNow, transaction } from '../database/pool.js';
import { nextAlertState, shareLinkExpiry } from '../domain/trip-state.js';
import {
  addEvent,
  extendShareLinks,
  recordCameraRequest,
  type TripRow,
} from '../modules/trips/trips.repository.js';
import { enqueueContactAlerts } from '../modules/contact-alerts/contact-alerts.repository.js';

interface DueTripRow extends TripRow {
  response_seconds: number;
  due_reason: 'late' | 'signal_lost' | null;
}

export async function advanceDueAlerts(): Promise<number> {
  return transaction(async (db) => {
    const [rows] = await db.execute<DueTripRow[]>(
      `SELECT t.*, u.response_seconds,
        CASE
          WHEN (u.arrival_checkin = TRUE OR t.mode = 'timer') AND t.expected_arrival_at <= UTC_TIMESTAMP(3) THEN 'late'
          WHEN u.signal_loss_minutes > 0 AND t.last_position_received_at IS NOT NULL AND t.last_position_received_at <= UTC_TIMESTAMP(3) - INTERVAL u.signal_loss_minutes MINUTE THEN 'signal_lost'
          ELSE NULL
        END AS due_reason
      FROM trips t JOIN users u ON u.id = t.user_id
      WHERE (t.status = 'active' AND (
          (u.arrival_checkin = TRUE OR t.mode = 'timer') AND t.expected_arrival_at <= UTC_TIMESTAMP(3)
          OR (u.signal_loss_minutes > 0 AND t.last_position_received_at IS NOT NULL AND t.last_position_received_at <= UTC_TIMESTAMP(3) - INTERVAL u.signal_loss_minutes MINUTE)
        ))
        OR (t.status = 'checkin_pending' AND t.alert_deadline <= UTC_TIMESTAMP(3))
        OR (t.status = 'alerted' AND t.escalation_deadline <= UTC_TIMESTAMP(3))
      ORDER BY t.started_at LIMIT 25 FOR UPDATE SKIP LOCKED`,
    );
    let changed = 0;
    const now = await databaseNow(db);
    for (const row of rows) {
      if (row.status === 'active') {
        const reason = row.due_reason ?? 'late';
        await db.execute(
          'UPDATE trips SET status = ?, alert_deadline = ?, alert_reason = ? WHERE id = ?',
          [
            'checkin_pending',
            new Date(now.getTime() + Number(row.response_seconds) * 1000),
            reason,
            row.id,
          ],
        );
        await addEvent(
          db,
          row.id,
          reason === 'signal_lost' ? 'signal_loss_checkin_requested' : 'arrival_checkin_requested',
        );
        changed++;
        continue;
      }
      const [acknowledgments] = await db.execute<RowDataPacket[]>(
        'SELECT contact_id FROM trip_contacts WHERE trip_id = ? AND acknowledged_at IS NOT NULL LIMIT 1',
        [row.id],
      );
      const next = nextAlertState(
        row.status,
        row.alert_deadline,
        row.escalation_deadline,
        acknowledgments.length > 0,
        now,
      );
      if (next === row.status) continue;
      await db.execute(
        'UPDATE trips SET status = ?, alert_deadline = NULL, escalation_deadline = ? WHERE id = ?',
        [next, next === 'alerted' ? new Date(now.getTime() + 120000) : null, row.id],
      );
      if (next === 'alerted') {
        // Confirmações dadas antes do alerta não valem como resposta ao alerta.
        await db.execute('UPDATE trip_contacts SET acknowledged_at = NULL WHERE trip_id = ?', [
          row.id,
        ]);
        await extendShareLinks(db, row.id, shareLinkExpiry(now, row.expected_arrival_at));
        // No answer to the check-in (stop, deviation, delay, lost signal): ask the cameras.
        await recordCameraRequest(db, row, now, row.alert_reason ?? 'late');
        await enqueueContactAlerts(db, row.id, row.alert_reason ?? 'late', now);
      }
      await addEvent(
        db,
        row.id,
        next === 'alerted' ? 'contacts_alert_queued' : 'gcm_escalation_simulated',
        { externalMessagesSent: false },
      );
      changed++;
    }
    return changed;
  });
}
