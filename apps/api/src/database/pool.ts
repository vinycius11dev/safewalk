import type { RowDataPacket } from 'mysql2';
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 50,
  timezone: 'Z',
  charset: 'utf8mb4',
  multipleStatements: false,
});

/** Relógio do banco (UTC): referência única para prazos, igual à usada pelo worker de alertas. */
export async function databaseNow(db: Pool | PoolConnection = pool): Promise<Date> {
  const [rows] = await db.execute<(RowDataPacket & { now: Date })[]>(
    'SELECT UTC_TIMESTAMP(3) AS now',
  );
  const now = rows[0]?.now;
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error('O banco não retornou o horário atual.');
  return now;
}

export async function transaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
