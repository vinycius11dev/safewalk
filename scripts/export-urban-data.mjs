import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

/**
 * Exporta só os dados urbanos públicos importados (GeoSampa, SP156, semáforos...) para levar a
 * outro banco: tabelas `urban_imports` e `urban_import_features`, em NDJSON compactado.
 * Contas, trajetos, relatos e o cache de provedores ficam de fora.
 *   node scripts/export-urban-data.mjs <arquivo-saida.ndjson.gz>
 */
const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: resolve(root, 'apps/api/.env'), quiet: true });
const output = resolve(process.argv[2] ?? resolve(root, 'work/urban-data.ndjson.gz'));
const BATCH = 2000;

const encode = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? { $date: value.toISOString() } : value,
    ]),
  );

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
});
await mkdir(dirname(output), { recursive: true });
const gzip = createGzip({ level: 9 });
const done = new Promise((ok, fail) => {
  gzip.pipe(createWriteStream(output)).on('finish', ok).on('error', fail);
});
const write = (line) =>
  gzip.write(`${JSON.stringify(line)}\n`)
    ? Promise.resolve()
    : new Promise((ok) => gzip.once('drain', ok));

try {
  const [imports] = await connection.query('SELECT * FROM urban_imports ORDER BY completed_at');
  for (const row of imports) await write({ table: 'urban_imports', row: encode(row) });
  let features = 0;
  for (const { id } of imports) {
    let after = '';
    for (;;) {
      const [rows] = await connection.query(
        'SELECT * FROM urban_import_features WHERE import_id = ? AND external_id > ? ORDER BY external_id LIMIT ?',
        [id, after, BATCH],
      );
      if (rows.length === 0) break;
      for (const row of rows) await write({ table: 'urban_import_features', row: encode(row) });
      features += rows.length;
      after = rows.at(-1).external_id;
    }
  }
  gzip.end();
  await done;
  console.info(`${imports.length} importações e ${features} feições exportadas para ${output}`);
} finally {
  await connection.end();
}
