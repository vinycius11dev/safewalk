import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

/**
 * Importa o arquivo gerado por scripts/export-urban-data.mjs no banco configurado no `.env` da API
 * (rodar na pasta da API). Só mexe em `urban_imports` e nas tabelas ligadas a cada importação
 * (`urban_import_features`, `crime_points`, `infosiga_municipalities`): cada importação do arquivo
 * substitui a de mesmo id, numa transação; para SSP e Infosiga, o lote anterior da fonte também sai.
 * Contas, trajetos e relatos não são tocados.
 *   node scripts/import-urban-data.mjs urban-data.ndjson.gz
 */
dotenv.config({ quiet: true });
const file = process.argv[2];
if (!file) throw new Error('Informe o arquivo .ndjson.gz.');
const ALLOWED = new Set([
  'urban_imports',
  'urban_import_features',
  'crime_points',
  'infosiga_municipalities',
]);
// Fontes com um único lote vigente (os importadores originais apagam o lote anterior da mesma fonte).
const SINGLE_LOT_SOURCES = new Set(['ssp-crimes', 'infosiga']);
const BATCH = 500;

/** Datas voltam a ser Date; colunas JSON (que o driver lê como objeto) voltam a ser texto JSON. */
const decode = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value === null || typeof value !== 'object') return [key, value];
      if (!Array.isArray(value) && '$date' in value) return [key, new Date(value.$date)];
      return [key, JSON.stringify(value)];
    }),
  );

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  charset: 'utf8mb4',
});

const pending = new Map();
let inserted = 0;
async function flush(table) {
  const rows = pending.get(table) ?? [];
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const names = columns.map((column) => `\`${column.replace(/`/g, '')}\``).join(', ');
  const marks = `(${columns.map(() => '?').join(', ')})`;
  await connection.query(
    `INSERT INTO \`${table}\` (${names}) VALUES ${rows.map(() => marks).join(', ')}`,
    rows.flatMap((row) => columns.map((column) => row[column])),
  );
  inserted += rows.length;
  pending.set(table, []);
}

try {
  await connection.beginTransaction();
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()) });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const { table, row } = JSON.parse(line);
    if (!ALLOWED.has(table)) throw new Error(`Tabela não permitida no arquivo: ${table}`);
    const decoded = decode(row);
    if (table === 'urban_imports') {
      // Substitui a importação de mesmo id (as feições saem junto, por ON DELETE CASCADE).
      await connection.query('DELETE FROM urban_imports WHERE id = ?', [decoded.id]);
      if (SINGLE_LOT_SOURCES.has(decoded.source_id))
        await connection.query('DELETE FROM urban_imports WHERE source_id = ? AND id <> ?', [
          decoded.source_id,
          decoded.id,
        ]);
    } else await flush('urban_imports');
    const rows = pending.get(table) ?? [];
    rows.push(decoded);
    pending.set(table, rows);
    if (rows.length >= BATCH) await flush(table);
  }
  await flush('urban_imports');
  for (const table of ALLOWED) await flush(table);
  await connection.commit();
  console.info(`Importação concluída: ${inserted} linhas.`);
} catch (error) {
  await connection.rollback();
  console.error(error instanceof Error ? error.message : 'Falha na importação.');
  process.exitCode = 1;
} finally {
  await connection.end();
}
