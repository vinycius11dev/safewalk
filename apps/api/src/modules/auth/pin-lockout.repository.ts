import type { RowDataPacket } from 'mysql2';
import { databaseNow, transaction } from '../../database/pool.js';
import { pinLockMessage, pinLockSeconds } from '../../domain/pin-lockout.js';
import { AppError } from '../../middleware/errors.js';

interface PinAttemptRow extends RowDataPacket {
  pin_failed_attempts: number;
  pin_locked_until: Date | null;
}

/**
 * Reserva uma tentativa de PIN antes de conferir o valor. Contar antes impede que
 * várias tentativas simultâneas passem juntas pelo mesmo limite. O acerto zera o contador.
 */
export async function reservePinAttempt(userId: string): Promise<void> {
  await transaction(async (db) => {
    const [rows] = await db.execute<PinAttemptRow[]>(
      'SELECT pin_failed_attempts, pin_locked_until FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const row = rows[0];
    if (!row) return;
    const now = await databaseNow(db);
    if (row.pin_locked_until && row.pin_locked_until.getTime() > now.getTime())
      throw new AppError(
        429,
        'PIN_LOCKED',
        pinLockMessage((row.pin_locked_until.getTime() - now.getTime()) / 1000),
      );
    const attempts = Number(row.pin_failed_attempts) + 1;
    const lockSeconds = pinLockSeconds(attempts);
    await db.execute(
      'UPDATE users SET pin_failed_attempts = ?, pin_locked_until = ? WHERE id = ?',
      [
        Math.min(attempts, 65_535),
        lockSeconds > 0 ? new Date(now.getTime() + lockSeconds * 1000) : null,
        userId,
      ],
    );
  });
}

export async function clearPinFailures(userId: string): Promise<void> {
  await transaction(async (db) => {
    await db.execute(
      'UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ? AND (pin_failed_attempts > 0 OR pin_locked_until IS NOT NULL)',
      [userId],
    );
  });
}
