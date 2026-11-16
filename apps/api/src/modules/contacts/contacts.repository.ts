import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { Contact, ContactInput } from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import { AppError } from '../../middleware/errors.js';
import { canPreserveEmailTripAlertConsent } from './email-consent.js';

interface ContactRow extends RowDataPacket {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string;
  accepted: number;
  email_trip_alerts: number;
  email_trip_alerts_consented_at: Date | null;
  default_accompany: number;
}
const mapContact = (row: ContactRow): Contact => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  ...(row.email ? { email: row.email } : {}),
  emailTripAlerts: Boolean(row.email_trip_alerts && row.email_trip_alerts_consented_at),
  relationship: row.relationship,
  accepted: Boolean(row.accepted),
  defaultAccompany: Boolean(row.default_accompany),
});
export async function listContacts(userId: string): Promise<Contact[]> {
  const [rows] = await pool.execute<ContactRow[]>(
    'SELECT id, name, phone, email, relationship, accepted, email_trip_alerts, email_trip_alerts_consented_at, default_accompany FROM contacts WHERE user_id = ? ORDER BY created_at',
    [userId],
  );
  return rows.map(mapContact);
}

export interface TripStartEmailTarget {
  id: string;
  email: string | null;
  accepted: boolean;
  emailTripAlerts: boolean;
}

export async function getTripStartEmailTargets(
  userId: string,
  contactIds: readonly string[],
): Promise<TripStartEmailTarget[]> {
  if (contactIds.length === 0) return [];
  const placeholders = contactIds.map(() => '?').join(', ');
  const [rows] = await pool.execute<ContactRow[]>(
    `SELECT id, name, phone, email, relationship, accepted, email_trip_alerts, email_trip_alerts_consented_at, default_accompany
     FROM contacts WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...contactIds],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    accepted: Boolean(row.accepted),
    emailTripAlerts: Boolean(row.email_trip_alerts && row.email_trip_alerts_consented_at),
  }));
}

export interface ContactInvitationEmailTarget {
  id: string;
  email: string | null;
  accepted: boolean;
  emailTripAlerts: boolean;
}

export async function getContactInvitationEmailTarget(
  userId: string,
  contactId: string,
): Promise<ContactInvitationEmailTarget | null> {
  const [rows] = await pool.execute<ContactRow[]>(
    'SELECT id, name, phone, email, relationship, accepted, email_trip_alerts, email_trip_alerts_consented_at, default_accompany FROM contacts WHERE id = ? AND user_id = ?',
    [contactId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    accepted: Boolean(row.accepted),
    emailTripAlerts: Boolean(row.email_trip_alerts && row.email_trip_alerts_consented_at),
  };
}
export async function createContact(
  userId: string,
  input: ContactInput,
  accepted = false,
): Promise<Contact> {
  if (input.emailTripAlerts)
    throw new AppError(
      409,
      'CONTACT_EMAIL_CONSENT_REQUIRED',
      'O próprio contato precisa autorizar o envio por e-mail ao aceitar o convite.',
    );
  const id = randomUUID();
  await transaction(async (connection) => {
    await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    const [counts] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM contacts WHERE user_id = ?',
      [userId],
    );
    if (Number(counts[0]?.total) >= 5)
      throw new AppError(409, 'CONTACT_LIMIT', 'Você pode cadastrar até 5 contatos de segurança.');
    await connection.execute(
      'INSERT INTO contacts (id, user_id, name, phone, email, relationship, accepted, email_trip_alerts, email_trip_alerts_consented_at) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NULL)',
      [id, userId, input.name, input.phone, input.email ?? null, input.relationship, accepted],
    );
  });
  return { id, ...input, accepted, defaultAccompany: true };
}
export async function deleteContact(userId: string, id: string): Promise<void> {
  await transaction(async (connection) => {
    const [rows] = await connection.execute<ContactRow[]>(
      'SELECT * FROM contacts WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId],
    );
    if (!rows[0]) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contato não encontrado.');
    const [active] = await connection.execute<RowDataPacket[]>(
      'SELECT t.id FROM trips t JOIN trip_contacts tc ON tc.trip_id = t.id WHERE tc.contact_id = ? AND t.active_user_id IS NOT NULL LIMIT 1',
      [id],
    );
    if (active.length)
      throw new AppError(
        409,
        'CONTACT_IN_ACTIVE_TRIP',
        'Encerre o trajeto antes de remover um contato que está acompanhando.',
      );
    await connection.execute('DELETE FROM contacts WHERE id = ? AND user_id = ?', [id, userId]);
  });
}

export async function updateContact(
  userId: string,
  id: string,
  input: ContactInput & { defaultAccompany: boolean },
): Promise<Contact> {
  return transaction(async (connection) => {
    const [rows] = await connection.execute<ContactRow[]>(
      'SELECT * FROM contacts WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId],
    );
    const row = rows[0];
    if (!row) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contato não encontrado.');
    if (input.emailTripAlerts && (!row.accepted || !row.email_trip_alerts_consented_at))
      throw new AppError(
        409,
        'CONTACT_EMAIL_CONSENT_REQUIRED',
        'O próprio contato precisa autorizar o envio por e-mail ao aceitar o convite.',
      );
    const [active] = await connection.execute<RowDataPacket[]>(
      'SELECT t.id FROM trips t JOIN trip_contacts tc ON tc.trip_id = t.id WHERE tc.contact_id = ? AND t.active_user_id IS NOT NULL LIMIT 1',
      [id],
    );
    if (active.length)
      throw new AppError(
        409,
        'CONTACT_IN_ACTIVE_TRIP',
        'Encerre o trajeto antes de alterar um contato que está acompanhando.',
      );
    const phoneChanged = row.phone.replace(/\D/g, '') !== input.phone.replace(/\D/g, '');
    const emailChanged = (row.email ?? '') !== (input.email ?? '');
    const identityChanged = phoneChanged || emailChanged;
    const accepted = identityChanged ? false : Boolean(row.accepted);
    const emailTripAlerts = canPreserveEmailTripAlertConsent(
      identityChanged,
      Boolean(row.email_trip_alerts && row.email_trip_alerts_consented_at),
      input.emailTripAlerts,
    );
    const emailTripAlertsConsentedAt = emailTripAlerts ? row.email_trip_alerts_consented_at : null;
    await connection.execute(
      'UPDATE contacts SET name = ?, phone = ?, email = ?, relationship = ?, accepted = ?, email_trip_alerts = ?, email_trip_alerts_consented_at = ?, default_accompany = ? WHERE id = ? AND user_id = ?',
      [
        input.name,
        input.phone,
        input.email ?? null,
        input.relationship,
        accepted,
        emailTripAlerts,
        emailTripAlertsConsentedAt,
        input.defaultAccompany,
        id,
        userId,
      ],
    );
    if (identityChanged) {
      await connection.execute(
        'UPDATE share_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE contact_id = ? AND revoked_at IS NULL',
        [id],
      );
      await connection.execute(
        'UPDATE contact_invitations SET responded_at = UTC_TIMESTAMP(3) WHERE contact_id = ? AND responded_at IS NULL',
        [id],
      );
    }
    return {
      id,
      name: input.name,
      phone: input.phone,
      ...(input.email ? { email: input.email } : {}),
      emailTripAlerts,
      relationship: input.relationship,
      defaultAccompany: input.defaultAccompany,
      accepted,
    };
  });
}
