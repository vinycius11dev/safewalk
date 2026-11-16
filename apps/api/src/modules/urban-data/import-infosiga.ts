import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { pool } from '../../database/pool.js';
import { streamInfosiga } from '../../integrations/urban/infosiga-stream.js';
import { municipalitySummary, saveInfosigaImport } from './infosiga.repository.js';

const args = parseArgs({
  options: {
    file: { type: 'string' },
    commit: { type: 'boolean', default: false },
    summary: { type: 'string' },
  },
  strict: true,
});
try {
  const file = resolve(z.string().min(1).parse(args.values.file));
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size > 200_000_000) throw new Error('INFOSIGA_ZIP_LIMIT');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const resourceId = hash.digest('hex');
  const result = args.values.commit
    ? await saveInfosigaImport(file, resourceId)
    : { id: null, completedAt: null, stats: await streamInfosiga(file, async () => {}) };
  const summaries = municipalitySummary(result.stats);
  if (args.values.summary) {
    const summaryPath = resolve(args.values.summary);
    try {
      await writeFile(
        summaryPath,
        JSON.stringify(
          {
            source: 'Infosiga / Detran-SP',
            sourceUrl: 'https://infosiga.detran.sp.gov.br/',
            license: 'CC BY 4.0',
            importId: result.id,
            completedAt: result.completedAt,
            validCoordinatePercent: Number(
              ((result.stats.features / result.stats.relevant) * 100).toFixed(1),
            ),
            totals: {
              scanned: result.stats.scanned,
              relevant: result.stats.relevant,
              withCoordinates: result.stats.features,
              withoutCoordinates: result.stats.withoutCoordinates,
              outsideEnvelope: result.stats.outsideBounds,
            },
            municipalities: summaries,
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch {
      console.error(
        'INFOSIGA_SUMMARY_WRITE_FAILED; consulte os totais no banco se a importação foi concluída.',
      );
      process.exitCode = 1;
    }
  }
  console.info(
    JSON.stringify({
      committed: args.values.commit,
      importId: result.id,
      completedAt: result.completedAt,
      scanned: result.stats.scanned,
      relevant: result.stats.relevant,
      withCoordinates: result.stats.features,
      withoutCoordinates: result.stats.withoutCoordinates,
      outsideEnvelope: result.stats.outsideBounds,
      validCoordinatePercent: Number(
        ((result.stats.features / result.stats.relevant) * 100).toFixed(1),
      ),
      municipalities: summaries.length,
      summarySaved: Boolean(args.values.summary && !process.exitCode),
    }),
  );
} catch (error) {
  console.error(
    'Importação Infosiga não concluída:',
    error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
