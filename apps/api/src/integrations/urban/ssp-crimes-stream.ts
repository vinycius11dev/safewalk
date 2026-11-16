import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { routeDayPeriodSchema } from '@safewalk/contracts';
import { saoPauloBounds } from '../../domain/service-area.js';

const [west, south, east, north] = saoPauloBounds;
export const sspStatsSchema = z
  .object({
    files: z.number().int().positive(),
    scanned: z.number().int().positive(),
    relevant: z.number().int().positive(),
    withoutCoordinates: z.number().int().nonnegative(),
    outsideBounds: z.number().int().nonnegative(),
    invalidDate: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    features: z.number().int().positive(),
    firstDate: z.iso.date(),
    lastDate: z.iso.date(),
  })
  .strict();
export type SspStats = z.infer<typeof sspStatsSchema>;
const pointSchema = z
  .object({
    kind: z.literal('feature'),
    externalId: z.string().regex(/^[a-f0-9]{64}$/),
    latitude: z.number().finite().min(south).max(north),
    longitude: z.number().finite().min(west).max(east),
    date: z.iso.date(),
    category: z.enum(['robbery', 'theft', 'assault', 'sexual']),
    period: routeDayPeriodSchema.nullable(),
  })
  .strict();
export type SspCrimePoint = z.infer<typeof pointSchema>;
const recordSchema = z.discriminatedUnion('kind', [
  pointSchema,
  z.object({ kind: z.literal('complete'), stats: sspStatsSchema }).strict(),
]);

/** Roda o extrator em Python e entrega somente tipo, data, período e coordenada. */
export async function streamSspCrimes(
  files: string[],
  onPoints: (batch: SspCrimePoint[]) => Promise<void>,
): Promise<SspStats> {
  const python =
    process.env.INFOSIGA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const script = fileURLToPath(new URL('./ssp_crimes_extract.py', import.meta.url));
  const child = spawn(python, ['-I', script, ...saoPauloBounds.map(String), ...files], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let failure = '';
  child.stderr.on('data', (chunk: Buffer) => {
    failure = `${failure}${chunk.toString()}`.slice(0, 200);
  });
  const completion = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? -1));
  });
  let buffer = '';
  let count = 0;
  let stats: SspStats | null = null;
  let batch: SspCrimePoint[] = [];
  async function accept(line: string): Promise<void> {
    if (stats) throw new Error('SSP_DATA_AFTER_COMPLETE');
    const record = recordSchema.parse(JSON.parse(line) as unknown);
    if (record.kind === 'complete') {
      stats = record.stats;
      return;
    }
    batch.push(record);
    count++;
    if (batch.length >= 500) {
      const current = batch;
      batch = [];
      await onPoints(current);
    }
  }
  try {
    for await (const chunk of child.stdout) {
      buffer += String(chunk);
      if (buffer.length > 2_000_000) throw new Error('SSP_OUTPUT_LIMIT');
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) await accept(line);
        newline = buffer.indexOf('\n');
      }
    }
    if (buffer.trim()) throw new Error('SSP_INCOMPLETE_OUTPUT');
    const code = await completion;
    if (code !== 0 || !stats) throw new Error(failure.trim() || 'SSP_EXTRACTION_FAILED');
    const result = sspStatsSchema.parse(stats);
    if (result.features !== count) throw new Error('SSP_INCONSISTENT_COUNTS');
    if (batch.length) await onPoints(batch);
    return result;
  } catch (error) {
    child.kill();
    await completion.catch(() => undefined);
    throw error;
  }
}
