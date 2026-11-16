import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  urbanBoundsSchema,
  pilotBounds,
  sp156CityImportBounds,
} from '../../integrations/urban/urban-bounds.js';
import { getSp156Resource, readSp156File } from '../../integrations/urban/sp156.js';
import { saveSp156Import } from './urban.repository.js';
import { pool } from '../../database/pool.js';

const args = parseArgs({
  options: {
    file: { type: 'string' },
    'resource-id': { type: 'string' },
    bbox: { type: 'string' },
    city: { type: 'boolean', default: false },
  },
  strict: true,
});
try {
  const file = z.string().min(1).parse(args.values.file);
  const resourceId = z.uuid().parse(args.values['resource-id']);
  if (args.values.city && args.values.bbox) throw new Error('URBAN_SP156_CHOOSE_CITY_OR_BBOX');
  const bbox = args.values.city
    ? sp156CityImportBounds
    : args.values.bbox
      ? urbanBoundsSchema.parse(args.values.bbox.split(',').map(Number))
      : pilotBounds;
  const resource = await getSp156Resource(resourceId);
  const imported = await readSp156File(resolve(file), resourceId, bbox);
  if (imported.truncated) throw new Error('URBAN_SP156_TOO_MANY_FEATURES_IMPORT_PRESERVED');
  const saved = await saveSp156Import({
    ...imported,
    bbox,
    resourceId,
    sourceUrl: resource.url,
    publishedAt: resource.publishedAt,
  });
  console.info(
    JSON.stringify({
      source: 'SP156',
      scope: args.values.city
        ? 'São Paulo (faixa operacional, sem polígono municipal)'
        : 'área selecionada',
      resource: resource.name,
      license: resource.license,
      publishedAt: resource.publishedAt,
      ...saved,
      rowsScanned: imported.rowsScanned,
      relevantRows: imported.relevantRows,
      rowsWithoutCoordinates: imported.rowsWithoutCoordinates,
      truncated: imported.truncated,
    }),
  );
} catch (error) {
  console.error(
    'Importação SP156 não concluída:',
    error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
