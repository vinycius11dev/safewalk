import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2';
import { pool } from './pool.js';

const directory = fileURLToPath(new URL('../../../../database/migrations/', import.meta.url));
try {
  await pool.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(160) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const sql = await readFile(`${directory}/${name}`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT checksum FROM schema_migrations WHERE name = ?',
      [name],
    );
    if (rows[0]) {
      if (rows[0].checksum !== checksum)
        throw new Error(`Migração aplicada foi modificada: ${name}`);
      continue;
    }
    for (const statement of sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean))
      await pool.query(statement);
    await pool.execute('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [
      name,
      checksum,
    ]);
    console.info(`Migração aplicada: ${name}`);
  }
} finally {
  await pool.end();
}
