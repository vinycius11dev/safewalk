import type { RowDataPacket } from 'mysql2';
import { profileSettingsSchema, type ProfileSettings } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import { AppError } from '../../middleware/errors.js';

export async function getSettings(userId: string): Promise<ProfileSettings> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT response_seconds, walking_profile, automatic_detection, arrival_checkin, retention_days, contribute_reports, signal_loss_minutes FROM users WHERE id = ?',
    [userId],
  );
  const row = rows[0];
  if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Entre novamente.');
  return profileSettingsSchema.parse({
    responseSeconds: Number(row.response_seconds),
    walkingProfile: row.walking_profile,
    automaticDetection: Boolean(row.automatic_detection),
    arrivalCheckin: Boolean(row.arrival_checkin),
    retentionDays: Number(row.retention_days),
    contributeReports: Boolean(row.contribute_reports),
    signalLossMinutes: Number(row.signal_loss_minutes),
  });
}
export async function updateSettings(
  userId: string,
  input: ProfileSettings,
): Promise<ProfileSettings> {
  await pool.execute(
    'UPDATE users SET response_seconds = ?, walking_profile = ?, automatic_detection = ?, arrival_checkin = ?, retention_days = ?, contribute_reports = ?, signal_loss_minutes = ? WHERE id = ?',
    [
      input.responseSeconds,
      input.walkingProfile,
      input.automaticDetection,
      input.arrivalCheckin,
      input.retentionDays,
      input.contributeReports,
      input.signalLossMinutes,
      userId,
    ],
  );
  return getSettings(userId);
}
