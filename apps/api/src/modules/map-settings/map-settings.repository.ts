import type { RowDataPacket } from 'mysql2';
import { mapConsentVersion, type MapConsent } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
interface ConsentRow extends RowDataPacket {
  enabled: number;
  consent_version: string;
  updated_at: Date;
}
export async function getMapConsent(userId: string): Promise<MapConsent> {
  const [rows] = await pool.execute<ConsentRow[]>(
    'SELECT enabled, consent_version, updated_at FROM map_consents WHERE user_id = ?',
    [userId],
  );
  const row = rows[0];
  return row
    ? {
        enabled: Boolean(row.enabled) && row.consent_version === mapConsentVersion,
        version: row.consent_version,
        updatedAt: row.updated_at.toISOString(),
      }
    : { enabled: false, version: null, updatedAt: null };
}
export async function setMapConsent(userId: string, enabled: boolean): Promise<MapConsent> {
  await pool.execute(
    'INSERT INTO map_consents (user_id, enabled, consent_version) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), consent_version = VALUES(consent_version), updated_at = UTC_TIMESTAMP(3)',
    [userId, enabled, mapConsentVersion],
  );
  return getMapConsent(userId);
}
