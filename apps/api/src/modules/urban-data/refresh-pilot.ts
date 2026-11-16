import { getUrbanLayers } from './urban.service.js';
import { pilotBounds } from '../../integrations/urban/urban-bounds.js';
import { pool } from '../../database/pool.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

try {
  const args = parseArgs({ options: { output: { type: 'string' } }, strict: true });
  const result = await getUrbanLayers({ bbox: pilotBounds });
  const summary = {
    generatedAt: result.generatedAt,
    bbox: result.bbox,
    features: result.features.length,
    truncated: result.truncated,
    sources: result.sources,
    floodSummary: result.floodSummary,
    weather: result.weather,
    coverageWarnings: result.coverageWarnings,
    sampleFeatures: result.sources.flatMap((source) =>
      result.features.filter((feature) => feature.properties.sourceId === source.id).slice(0, 1),
    ),
  };
  const json = JSON.stringify(summary, null, 2);
  if (args.values.output) await writeFile(resolve(args.values.output), `${json}\n`, 'utf8');
  console.info(
    args.values.output
      ? JSON.stringify({
          generatedAt: result.generatedAt,
          features: result.features.length,
          truncated: result.truncated,
          sources: result.sources.map((source) => ({
            id: source.id,
            status: source.status,
            features: source.featureCount,
          })),
          output: args.values.output,
        })
      : json,
  );
} finally {
  await pool.end();
}
