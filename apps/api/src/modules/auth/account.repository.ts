import { transaction } from '../../database/pool.js';

export async function requestOwnedAccountDeletion(userId: string): Promise<void> {
  await transaction(async (connection) => {
    await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    await connection.execute(
      "INSERT INTO trip_events (trip_id,type,payload) SELECT id,'account_deletion_requested',JSON_OBJECT('outcome','cancelled','reason','account_deleted') FROM trips WHERE user_id = ? AND active_user_id IS NOT NULL",
      [userId],
    );
    await connection.execute(
      "UPDATE trips SET status = 'cancelled', active_user_id = NULL, alert_deadline = NULL, escalation_deadline = NULL WHERE user_id = ? AND active_user_id IS NOT NULL",
      [userId],
    );
    await connection.execute(
      "UPDATE share_tokens s JOIN trips t ON t.id = s.trip_id SET s.revoked_at = UTC_TIMESTAMP(3), s.revoked_reason = 'account_deleted' WHERE t.user_id = ? AND s.revoked_at IS NULL",
      [userId],
    );
    await connection.execute(
      'UPDATE contact_invitations i JOIN contacts c ON c.id = i.contact_id SET i.responded_at = UTC_TIMESTAMP(3) WHERE c.user_id = ? AND i.responded_at IS NULL',
      [userId],
    );
    await connection.execute(
      'UPDATE users SET deletion_requested_at = UTC_TIMESTAMP(3), purge_after = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 DAY) WHERE id = ? AND deletion_requested_at IS NULL',
      [userId],
    );
  });
}
