import type { RowDataPacket } from 'mysql2';
import { pool } from '../../database/pool.js';
interface FeedbackRow extends RowDataPacket {
  choice: 'confirm' | 'resolved';
}
export async function getFeedback(
  userId: string,
  incidentId: string,
): Promise<FeedbackRow['choice'] | null> {
  const [rows] = await pool.execute<FeedbackRow[]>(
    'SELECT choice FROM incident_feedback WHERE user_id = ? AND incident_id = ?',
    [userId, incidentId],
  );
  return rows[0]?.choice ?? null;
}
export async function saveFeedback(
  userId: string,
  incidentId: string,
  choice: FeedbackRow['choice'],
): Promise<void> {
  await pool.execute(
    'INSERT INTO incident_feedback (user_id, incident_id, choice) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = UTC_TIMESTAMP(3)',
    [userId, incidentId, choice],
  );
}
