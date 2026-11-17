import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

/**
 * Exporta só os dados urbanos públicos importados (GeoSampa, SP156, semáforos, boletins da SSP,
 * Infosiga...) para levar a outro banco: `urban_imports` e as tabelas ligadas a cada importação
 * (`urban_import_features`, `crime_points`, `infosiga_municipalities`), em NDJSON compactado.
 * Contas, trajetos, relatos e o cache de provedores ficam de fora.
 *   node scripts/export-urban-data.mjs <arquivo-saida.ndjson.gz> [--sources ssp-crimes,infosiga]
 */
const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: resolve(root, 'apps/api/.env'), quiet: true });
const args = process.argv.slice(2);
const sourcesAt = args.indexOf('--sources');
const sources =
  sourcesAt >= 0 ? new Set((args.splice(sourcesAt, 2)[1] ?? '').split(',').filter(Boolean)) : null;
const output = resolve(args[0] ?? resolve(root, 'work/urban-data.ndjson.gz'));
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

// Tabelas ligadas a uma importação, lidas em páginas pela chave (import_id, coluna).
const CHILDREN = [
  { table: 'urban_import_features', key: 'external_id' },
  { table: 'crime_points', key: 'external_id' },
  { table: 'infosiga_municipalities', key: 'municipality' },
];

try {
  const [all] = await connection.query('SELECT * FROM urban_imports ORDER BY completed_at');
  const imports = sources ? all.filter((row) => sources.has(row.source_id)) : all;
  for (const row of imports) await write({ table: 'urban_imports', row: encode(row) });
  const counts = Object.fromEntries(CHILDREN.map(({ table }) => [table, 0]));
  for (const { id } of imports) {
    for (const { table, key } of CHILDREN) {
      let after = '';
      for (;;) {
        const [rows] = await connection.query(
          `SELECT * FROM \`${table}\` WHERE import_id = ? AND \`${key}\` > ? ORDER BY \`${key}\` LIMIT ?`,
          [id, after, BATCH],
        );
        if (rows.length === 0) break;
        for (const row of rows) await write({ table, row: encode(row) });
        counts[table] += rows.length;
        after = rows.at(-1)[key];
      }
    }
  }
  gzip.end();
  await done;
  console.info(
    `${imports.length} importações exportadas para ${output}: ${counts.urban_import_features} feições, ${counts.crime_points} boletins da SSP, ${counts.infosiga_municipalities} municípios do Infosiga.`,
  );
} finally {
  await connection.end();
}
