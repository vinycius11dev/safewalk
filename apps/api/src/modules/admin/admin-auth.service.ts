import { SignJWT } from 'jose';
import type { AdminSession } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { hashSecret, verifySecret } from '../../domain/security.js';
import { AppError } from '../../middleware/errors.js';
import {
  findAdminByEmail,
  recordLoginSuccess,
  reserveLoginAttempt,
  toAdminUser,
  type AdminRow,
} from './admin-accounts.repository.js';

export const ADMIN_AUDIENCE = 'safewalk-admin';
const SESSION_HOURS = 8;
/** Hash de uma senha qualquer: conferir contra ele mantém o tempo igual quando o e-mail não existe. */
const unknownAccountHash = hashSecret('conta-inexistente-do-painel');

async function sessionFor(row: AdminRow): Promise<AdminSession> {
  const token = await new SignJWT({ role: row.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.id)
    .setIssuedAt()
    .setIssuer('safewalk-api')
    .setAudience(ADMIN_AUDIENCE)
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  return { token, user: toAdminUser(row) };
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const row = await findAdminByEmail(email);
  if (row) await reserveLoginAttempt(row.id);
  const valid = await verifySecret(password, row?.password_hash ?? (await unknownAccountHash));
  if (!row || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
  await recordLoginSuccess(row.id);
  return sessionFor(row);
}
