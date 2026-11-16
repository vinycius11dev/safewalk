import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { urbanFeatureSchema, type UrbanFeature } from '@safewalk/contracts';

const citySchema = z
  .object({
    relevant: z.number().int().nonnegative(),
    valid: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    outside: z.number().int().nonnegative(),
  })
  .strict();
export const infosigaStatsSchema = z
  .object({
    scanned: z.number().int().positive(),
    relevant: z.number().int().positive(),
    withoutCoordinates: z.number().int().nonnegative(),
    outsideBounds: z.number().int().nonnegative(),
    features: z.number().int().positive(),
    municipalities: z.record(z.string().min(1).max(120), citySchema),
  })
  .strict();
export type InfosigaStats = z.infer<typeof infosigaStatsSchema>;
const featureSchema = z
  .object({
    kind: z.literal('feature'),
    externalId: z.string().regex(/^[a-f0-9]{64}$/),
    latitude: z.number().finite().min(-25.4).max(-19.7),
    longitude: z.number().finite().min(-53.3).max(-44.0),
    date: z.iso.date(),
    municipality: z.string().trim().min(1).max(120),
    recordType: z.enum(['SINISTRO FATAL', 'SINISTRO NAO FATAL', 'NOTIFICACAO']),
  })
  .strict();
const completeSchema = z
  .object({ kind: z.literal('complete'), stats: infosigaStatsSchema })
  .strict();
const recordSchema = z.discriminatedUnion('kind', [featureSchema, completeSchema]);

export async function streamInfosiga(
  zipPath: string,
  onFeatures: (batch: UrbanFeature[]) => Promise<void>,
): Promise<InfosigaStats> {
  const python =
    process.env.INFOSIGA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const script = fileURLToPath(new URL('./infosiga_extract.py', import.meta.url));
  const child = spawn(python, [script, zipPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stderr.resume();
  const completion = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? -1));
  });
  let buffer = '';
  let count = 0;
  let stats: InfosigaStats | null = null;
  let batch: UrbanFeature[] = [];
  async function accept(line: string): Promise<void> {
    if (stats) throw new Error('INFOSIGA_DATA_AFTER_COMPLETE');
    const record = recordSchema.parse(JSON.parse(line) as unknown);
    if (record.kind === 'complete') {
      stats = record.stats;
      return;
    }
    const label =
      record.recordType === 'NOTIFICACAO' ? 'Notificação histórica' : 'Sinistro histórico';
    batch.push(
      urbanFeatureSchema.parse({
        type: 'Feature',
        id: `infosiga:${record.externalId}`,
        geometry: { type: 'Point', coordinates: [record.longitude, record.latitude] },
        properties: {
          sourceId: 'infosiga',
          sourceFeatureId: record.externalId,
          title: `${label} envolvendo pedestre`,
          type: 'pedestrian_crashes',
          category: 'other',
          observedAt: `${record.date}T00:00:00.000Z`,
          details: {
            recordType: record.recordType,
            municipality: record.municipality,
            pedestrianInvolved: true,
            historic: true,
            datePrecision: 'calendar_date',
            originalCoordinate: true,
            coordinatePrecision: 'unknown',
            currentConditionUnknown: true,
          },
        },
      }),
    );
    count++;
    if (batch.length >= 200) {
      const current = batch;
      batch = [];
      await onFeatures(current);
    }
  }
  try {
    for await (const chunk of child.stdout) {
      buffer += String(chunk);
      if (buffer.length > 1_000_000) throw new Error('INFOSIGA_OUTPUT_LIMIT');
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line) await accept(line);
        newline = buffer.indexOf('\n');
      }
    }
    if (buffer.trim()) throw new Error('INFOSIGA_INCOMPLETE_OUTPUT');
    const code = await completion;
    if (code !== 0 || !stats) throw new Error('INFOSIGA_EXTRACTION_FAILED');
    const result = infosigaStatsSchema.parse(stats);
    const totals = Object.values(result.municipalities).reduce(
      (sum, city) => ({
        relevant: sum.relevant + city.relevant,
        valid: sum.valid + city.valid,
        missing: sum.missing + city.missing,
        outside: sum.outside + city.outside,
      }),
      { relevant: 0, valid: 0, missing: 0, outside: 0 },
    );
    if (
      result.features !== count ||
      totals.relevant !== result.relevant ||
      totals.valid !== count ||
      totals.missing !== result.withoutCoordinates ||
      totals.outside !== result.outsideBounds ||
      result.relevant !== count + result.withoutCoordinates + result.outsideBounds
    )
      throw new Error('INFOSIGA_INCONSISTENT_COUNTS');
    if (batch.length) await onFeatures(batch);
    return result;
  } catch (error) {
    child.kill();
    await completion.catch(() => undefined);
    throw error;
  }
}
