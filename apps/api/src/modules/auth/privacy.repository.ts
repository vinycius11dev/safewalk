import type { RowDataPacket } from 'mysql2';
import { pool } from '../../database/pool.js';
import { removeReportPhoto } from '../reports/report-photo-storage.js';

export async function pruneExpiredHistory(userId?: string): Promise<void> {
  // Scope can be limited to one synthetic owner for integration tests and user requests.
  const ownerFilter = userId ? 'u.id = ? AND ' : '';
  const [expiredPhotos] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key FROM report_attachments a
     JOIN reports r ON r.id = a.report_id
     JOIN users u ON u.id = r.user_id
     WHERE ${ownerFilter}r.expires_at < UTC_TIMESTAMP(3)
       AND r.created_at < TIMESTAMPADD(DAY, -u.retention_days, UTC_TIMESTAMP(3))`,
    userId ? [userId] : [],
  );
  for (const row of expiredPhotos) await removeReportPhoto(String(row.storage_key));
  const [trips] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id FROM trips t JOIN users u ON u.id = t.user_id
     WHERE ${ownerFilter}t.status IN ('arrived','cancelled')
       AND COALESCE((SELECT MAX(e.created_at) FROM trip_events e WHERE e.trip_id = t.id AND e.type = 'trip_finished'), t.expected_arrival_at)
           < TIMESTAMPADD(DAY, -u.retention_days, UTC_TIMESTAMP(3)) LIMIT 100`,
    userId ? [userId] : [],
  );
  for (const trip of trips) {
    await pool.execute("DELETE FROM trips WHERE id = ? AND status IN ('arrived','cancelled')", [
      trip.id,
    ]);
  }
  await pool.execute(
    `DELETE r FROM reports r JOIN users u ON u.id = r.user_id
     WHERE ${ownerFilter}r.expires_at < UTC_TIMESTAMP(3)
       AND r.created_at < TIMESTAMPADD(DAY, -u.retention_days, UTC_TIMESTAMP(3))`,
    userId ? [userId] : [],
  );
  await pool.execute(
    `DELETE f FROM incident_feedback f JOIN users u ON u.id = f.user_id
     WHERE ${ownerFilter}f.updated_at < TIMESTAMPADD(DAY, -u.retention_days, UTC_TIMESTAMP(3))`,
    userId ? [userId] : [],
  );
  const [purgedAccountPhotos] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key FROM report_attachments a
     JOIN reports r ON r.id = a.report_id
     JOIN users u ON u.id = r.user_id
     WHERE u.deletion_requested_at IS NOT NULL AND u.purge_after <= UTC_TIMESTAMP(3)${userId ? ' AND u.id = ?' : ''}`,
    userId ? [userId] : [],
  );
  for (const row of purgedAccountPhotos) await removeReportPhoto(String(row.storage_key));
  await pool.execute(
    `DELETE FROM users WHERE deletion_requested_at IS NOT NULL AND purge_after <= UTC_TIMESTAMP(3)${userId ? ' AND id = ?' : ''}`,
    userId ? [userId] : [],
  );
}

export async function exportOwnedRecords(userId: string) {
  const [
    contacts,
    trips,
    positions,
    events,
    reports,
    incidentFeedback,
    reportFeedback,
    reportAttachments,
    mapConsent,
    savedPlaces,
  ] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      'SELECT id, name, phone, email, relationship, accepted, email_trip_alerts, email_trip_alerts_consented_at, default_accompany, created_at FROM contacts WHERE user_id = ? ORDER BY created_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT id, route_kind, destination, status, started_at, expected_arrival_at, alert_deadline, escalation_deadline, alert_reason, feedback, last_position, route_snapshot FROM trips WHERE user_id = ? ORDER BY started_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT p.trip_id, p.latitude, p.longitude, p.accuracy_meters, p.recorded_at, p.received_at FROM trip_positions p JOIN trips t ON t.id = p.trip_id WHERE t.user_id = ? ORDER BY p.recorded_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT e.trip_id, e.type, e.payload, e.created_at FROM trip_events e JOIN trips t ON t.id = e.trip_id WHERE t.user_id = ? ORDER BY e.created_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT id, type, description, address, latitude, longitude, status, share_with_community, public_latitude, public_longitude, community_status, share_with_government, gov_status, gov_updated_at, created_at, expires_at FROM reports WHERE user_id = ? ORDER BY created_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT incident_id, choice, updated_at FROM incident_feedback WHERE user_id = ? ORDER BY updated_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT f.report_id, f.choice, f.updated_at FROM report_feedback f JOIN reports r ON r.id = f.report_id WHERE f.user_id = ? ORDER BY f.updated_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT a.report_id, a.mime_type, a.byte_size, a.created_at FROM report_attachments a JOIN reports r ON r.id = a.report_id WHERE r.user_id = ? ORDER BY a.created_at',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT enabled, consent_version, updated_at FROM map_consents WHERE user_id = ?',
      [userId],
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT id, kind, label, address, latitude, longitude, created_at, updated_at FROM saved_places WHERE user_id = ? ORDER BY created_at',
      [userId],
    ),
  ]);
  return {
    contacts: contacts[0],
    trips: trips[0],
    positions: positions[0],
    events: events[0],
    reports: reports[0],
    incidentFeedback: incidentFeedback[0],
    reportFeedback: reportFeedback[0],
    reportAttachments: reportAttachments[0],
    mapConsent: mapConsent[0],
    savedPlaces: savedPlaces[0],
  };
}
