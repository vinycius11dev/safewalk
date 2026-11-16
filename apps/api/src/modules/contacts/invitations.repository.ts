import type { RowDataPacket } from 'mysql2';
import { env } from '../../config/env.js';
import { databaseNow, pool, transaction } from '../../database/pool.js';
import { createShareToken, hashShareToken } from '../../domain/security.js';
import { AppError } from '../../middleware/errors.js';
import { hasEmailTripAlertConsent, maskContactEmail } from './email-consent.js';

interface InvitationRow extends RowDataPacket {
  contact_id: string;
  inviter_name: string;
  contact_name: string;
  email: string | null;
  accepted: number;
  responded_at: Date | null;
  expires_at: Date;
}
export async function createInvitation(userId: string, contactId: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId],
  );
  if (!rows[0]) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contato não encontrado.');
  const token = createShareToken();
  const expiresAt = new Date((await databaseNow()).getTime() + 7 * 24 * 3600000);
  await pool.execute(
    'INSERT INTO contact_invitations (token_hash, contact_id, expires_at) VALUES (?, ?, ?)',
    [hashShareToken(token), contactId, expiresAt],
  );
  return { url: `${env.PUBLIC_WEB_URL}/convite/${token}`, expiresAt: expiresAt.toISOString() };
}
export async function getInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(410, 'INVITATION_EXPIRED', 'Este convite expirou.');
  const [rows] = await pool.execute<InvitationRow[]>(
    'SELECT c.id AS contact_id, c.name AS contact_name, c.email, c.accepted, u.name AS inviter_name, i.responded_at, i.expires_at FROM contact_invitations i JOIN contacts c ON c.id = i.contact_id JOIN users u ON u.id = c.user_id WHERE i.token_hash = ?',
    [hashShareToken(token)],
  );
  const row = rows[0];
  if (!row || row.expires_at.getTime() <= (await databaseNow()).getTime())
    throw new AppError(410, 'INVITATION_EXPIRED', 'Este convite expirou.');
  return {
    inviterName: row.inviter_name.split(' ')[0] ?? 'Seu contato',
    contactName: row.contact_name,
    maskedEmail: maskContactEmail(row.email),
    accepted: Boolean(row.accepted),
    responded: Boolean(row.responded_at),
    expiresAt: row.expires_at.toISOString(),
  };
}
export async function decideInvitation(
  token: string,
  accepted: boolean,
  emailTripAlerts: boolean,
): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(410, 'INVITATION_EXPIRED', 'Este convite expirou.');
  await transaction(async (db) => {
    const [rows] = await db.execute<InvitationRow[]>(
      'SELECT i.contact_id, i.expires_at, i.responded_at, c.email FROM contact_invitations i JOIN contacts c ON c.id = i.contact_id WHERE i.token_hash = ? FOR UPDATE',
      [hashShareToken(token)],
    );
    const row = rows[0];
    const now = await databaseNow(db);
    if (!row || row.expires_at.getTime() <= now.getTime())
      throw new AppError(410, 'INVITATION_EXPIRED', 'Este convite expirou.');
    if (row.responded_at)
      throw new AppError(409, 'INVITATION_USED', 'Este convite já foi respondido.');
    const canEnableEmailTripAlerts = hasEmailTripAlertConsent(accepted, emailTripAlerts, row.email);
    if (emailTripAlerts && !canEnableEmailTripAlerts)
      throw new AppError(
        400,
        'CONTACT_EMAIL_REQUIRED',
        'Informe um e-mail para autorizar os avisos de início de trajeto.',
      );
    await db.execute(
      'UPDATE contacts SET accepted = ?, email_trip_alerts = ?, email_trip_alerts_consented_at = ? WHERE id = ?',
      [accepted, canEnableEmailTripAlerts, canEnableEmailTripAlerts ? now : null, row.contact_id],
    );
    await db.execute(
      'UPDATE contact_invitations SET responded_at = UTC_TIMESTAMP(3) WHERE contact_id = ? AND responded_at IS NULL',
      [row.contact_id],
    );
  });
}
