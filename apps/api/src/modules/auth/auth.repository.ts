import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { User } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';

export interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  pin_hash: string | null;
  duress_pin_hash: string | null;
  is_demo: number;
  phone: string;
  /** Sessões emitidas antes deste instante (troca de senha por e-mail) não valem mais. */
  sessions_valid_after: Date | null;
}
export const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  hasPin: Boolean(row.pin_hash),
  hasDuressPin: Boolean(row.duress_pin_hash),
  demo: Boolean(row.is_demo),
});
export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE email = ? AND deletion_requested_at IS NULL',
    [email],
  );
  return rows[0];
}
export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE id = ? AND deletion_requested_at IS NULL',
    [id],
  );
  return rows[0];
}
export async function insertUser(
  name: string,
  email: string,
  passwordHash: string,
  pinHash: string | null = null,
  demo = false,
): Promise<UserRow> {
  const id = randomUUID();
  await pool.execute(
    'INSERT INTO users (id, name, email, password_hash, pin_hash, is_demo) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, email, passwordHash, pinHash, demo],
  );
  return {
    id,
    name,
    email,
    password_hash: passwordHash,
    pin_hash: pinHash,
    duress_pin_hash: null,
    is_demo: Number(demo),
    phone: '',
    sessions_valid_after: null,
  } as UserRow;
}
export async function setUserPin(id: string, hash: string): Promise<void> {
  await pool.execute('UPDATE users SET pin_hash = ? WHERE id = ?', [hash, id]);
}
export async function setUserDuressPin(id: string, hash: string | null): Promise<void> {
  await pool.execute('UPDATE users SET duress_pin_hash = ? WHERE id = ?', [hash, id]);
}

export async function updateUserProfile(
  id: string,
  input: { name: string; email: string; phone: string },
): Promise<UserRow | undefined> {
  await pool.execute('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [
    input.name,
    input.email,
    input.phone,
    id,
  ]);
  return findUserById(id);
}
