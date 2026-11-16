import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { AdminRole, AdminUser } from '@safewalk/contracts';
import { databaseNow, pool, transaction } from '../../database/pool.js';
import { pinLockMessage, pinLockSeconds } from '../../domain/pin-lockout.js';
import { AppError } from '../../middleware/errors.js';

export interface AdminRow extends RowDataPacket {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: AdminRole;
  failed_attempts: number;
  locked_until: Date | null;
  disabled_at: Date | null;
  sessions_valid_after: Date | null;
}

export const toAdminUser = (row: AdminRow): AdminUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
});

export async function findAdminByEmail(email: string): Promise<AdminRow | undefined> {
  const [rows] = await pool.execute<AdminRow[]>(
    'SELECT * FROM admin_users WHERE email = ? AND disabled_at IS NULL',
    [email],
  );
  return rows[0];
}

export async function findAdminById(id: string): Promise<AdminRow | undefined> {
  const [rows] = await pool.execute<AdminRow[]>(
    'SELECT * FROM admin_users WHERE id = ? AND disabled_at IS NULL',
    [id],
  );
  return rows[0];
}

/**
 * Conta a tentativa antes de conferir a senha, para que tentativas simultâneas não passem
 * juntas pelo mesmo limite. O bloqueio segue a mesma escada do PIN do aplicativo.
 */
export async function reserveLoginAttempt(adminId: string): Promise<void> {
  await transaction(async (db) => {
    const [rows] = await db.execute<AdminRow[]>(
      'SELECT failed_attempts, locked_until FROM admin_users WHERE id = ? FOR UPDATE',
      [adminId],
    );
    const row = rows[0];
    if (!row) return;
    const now = await databaseNow(db);
    if (row.locked_until && row.locked_until.getTime() > now.getTime())
      throw new AppError(
        429,
        'ADMIN_LOCKED',
        pinLockMessage((row.locked_until.getTime() - now.getTime()) / 1000),
      );
    const attempts = Number(row.failed_attempts) + 1;
    const lockSeconds = pinLockSeconds(attempts);
    await db.execute('UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [
      Math.min(attempts, 255),
      lockSeconds > 0 ? new Date(now.getTime() + lockSeconds * 1000) : null,
      adminId,
    ]);
  });
}

export async function recordLoginSuccess(adminId: string): Promise<void> {
  await pool.execute(
    'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(3) WHERE id = ?',
    [adminId],
  );
}

export async function insertAdmin(
  email: string,
  name: string,
  passwordHash: string,
  role: AdminRole,
): Promise<AdminRow> {
  const id = randomUUID();
  await pool.execute(
    'INSERT INTO admin_users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, email, name, passwordHash, role],
  );
  const created = await findAdminById(id);
  if (!created) throw new Error('A conta de operador não foi criada.');
  return created;
}
