import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PASSWORD_RESET_TTL_MINUTES } from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import type { ResetAccountKind } from '../../domain/password-reset.js';

/** Onde a senha de cada tipo de conta mora. Valores fixos: nada aqui vem da requisição. */
const ACCOUNTS: Record<ResetAccountKind, { update: string }> = {
  user: {
    update:
      'UPDATE users SET password_hash = ?, sessions_valid_after = UTC_TIMESTAMP() WHERE id = ? AND deletion_requested_at IS NULL',
  },
  admin: {
    update:
      'UPDATE admin_users SET password_hash = ?, sessions_valid_after = UTC_TIMESTAMP(), failed_attempts = 0, locked_until = NULL WHERE id = ? AND disabled_at IS NULL',
  },
};

export async function countRecentResetRequests(
  kind: ResetAccountKind,
  accountId: string,
): Promise<number> {
  const [rows] = await pool.execute<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM password_reset_tokens WHERE account_kind = ? AND account_id = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR',
    [kind, accountId],
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Guarda o hash do novo link. Links anteriores ainda abertos da mesma conta deixam de valer, e
 * registros com mais de um dia (já sem uso, nem para o limite por hora) são apagados.
 */
export async function storeResetToken(
  kind: ResetAccountKind,
  accountId: string,
  tokenHash: string,
): Promise<void> {
  await transaction(async (db) => {
    await db.execute(
      'DELETE FROM password_reset_tokens WHERE created_at < UTC_TIMESTAMP(3) - INTERVAL 1 DAY',
    );
    await db.execute(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE account_kind = ? AND account_id = ? AND used_at IS NULL',
      [kind, accountId],
    );
    await db.execute(
      'INSERT INTO password_reset_tokens (id, account_kind, account_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3) + INTERVAL ? MINUTE, UTC_TIMESTAMP(3))',
      [randomUUID(), kind, accountId, tokenHash, PASSWORD_RESET_TTL_MINUTES],
    );
  });
}

/** O e-mail não saiu: o link não chegou a ninguém, então não precisa continuar válido. */
export async function discardResetToken(tokenHash: string): Promise<void> {
  await pool.execute('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
}

export async function isResetTokenUsable(
  kind: ResetAccountKind,
  tokenHash: string,
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM password_reset_tokens WHERE token_hash = ? AND account_kind = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)',
    [tokenHash, kind],
  );
  return rows.length > 0;
}

/**
 * Usa o link uma única vez: troca a senha, encerra as sessões antigas e invalida os outros links
 * da conta, tudo na mesma transação. Devolve o id da conta ou `null` se o link não vale mais.
 */
export async function consumeResetToken(
  kind: ResetAccountKind,
  tokenHash: string,
  passwordHash: string,
): Promise<string | null> {
  return transaction(async (db) => {
    const [rows] = await db.execute<(RowDataPacket & { account_id: string })[]>(
      'SELECT account_id FROM password_reset_tokens WHERE token_hash = ? AND account_kind = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE',
      [tokenHash, kind],
    );
    const accountId = rows[0]?.account_id;
    if (!accountId) return null;
    const [updated] = await db.execute<ResultSetHeader>(ACCOUNTS[kind].update, [
      passwordHash,
      accountId,
    ]);
    await db.execute(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE account_kind = ? AND account_id = ? AND used_at IS NULL',
      [kind, accountId],
    );
    return updated.affectedRows > 0 ? accountId : null;
  });
}
