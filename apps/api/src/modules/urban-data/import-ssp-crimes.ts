import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pool } from '../../database/pool.js';
import { saveSspCrimesImport } from './ssp-crimes.repository.js';

const args = parseArgs({
  options: { file: { type: 'string', multiple: true } },
  strict: true,
});
try {
  const files = (args.values.file ?? []).map((file) => resolve(file));
  if (!files.length) throw new Error('SSP_FILE_REQUIRED');
  const hash = createHash('sha256');
  for (const file of files) {
    const metadata = await stat(file);
    if (!metadata.isFile() || metadata.size > 400_000_000) throw new Error('SSP_FILE_LIMIT');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
  }
  const result = await saveSspCrimesImport(files, hash.digest('hex'));
  console.info(JSON.stringify(result));
} catch (error) {
  console.error(
    'Importação da SSP não concluída:',
    error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
