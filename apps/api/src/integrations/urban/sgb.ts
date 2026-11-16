import { z } from 'zod';
import { urbanFeatureSchema, urbanGeometrySchema, type UrbanFeature } from '@safewalk/contracts';
import type { UrbanBounds } from './urban-bounds.js';
import { publicJson } from './public-http.js';

const pageSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z
    .array(z.object({ geometry: z.unknown(), properties: z.record(z.string(), z.unknown()) }))
    .max(50),
  exceededTransferLimit: z.boolean().optional(),
  properties: z.object({ exceededTransferLimit: z.boolean().optional() }).optional(),
});
const sourceId = 'sgb-flood-susceptibility';
const cleanText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 250) : null;

export function normalizeSgbFeature(
  geometry: unknown,
  properties: Record<string, unknown>,
): UrbanFeature {
  const objectId = z.number().int().nonnegative().safeParse(properties.objectid);
  if (!objectId.success) throw new Error('SGB_INVALID_ID');
  const shape = urbanGeometrySchema.parse(geometry);
  if (shape.type !== 'Polygon' && shape.type !== 'MultiPolygon')
    throw new Error('SGB_INVALID_GEOMETRY');
  const classification = cleanText(properties.classe);
  const municipality = cleanText(properties.municipio);
  const year =
    typeof properties.ano === 'number' &&
    Number.isInteger(properties.ano) &&
    properties.ano >= 1900 &&
    properties.ano <= 2100
      ? properties.ano
      : null;
  return urbanFeatureSchema.parse({
    type: 'Feature',
    id: `${sourceId}:${objectId.data}`,
    geometry: shape,
    properties: {
      title: `Suscetibilidade à inundação${classification ? ` · ${classification}` : ''}`,
      type: 'flood_susceptibility',
      category: 'flood',
      sourceId,
      sourceFeatureId: String(objectId.data),
      observedAt: null,
      details: {
        susceptibilityClass: classification,
        studyYear: year,
        municipality,
        sourceExecution: cleanText(properties.execucao),
        sourceExecutor: cleanText(properties.executor),
        sourceProject: cleanText(properties.projeto),
        sourceDescription: cleanText(properties.fonte),
        liveFlood: false,
        currentConditionUnknown: true,
      },
    },
  });
}

/** Official SGB spatial query. Keyset pagination avoids skipping geometry-filtered results. */
export async function fetchSgbSusceptibility(
  bbox: UrbanBounds,
): Promise<{ features: UrbanFeature[]; truncated: boolean }> {
  const result: UrbanFeature[] = [];
  let after = -1;
  let truncated = false;
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(
      'https://geoportal.sgb.gov.br/server/rest/services/gestaoterritorial/inundacao/MapServer/0/query',
    );
    url.search = new URLSearchParams({
      f: 'geojson',
      where: after < 0 ? '1=1' : `objectid > ${after}`,
      geometry: bbox.join(','),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outSR: '4326',
      outFields: 'objectid,uf,municipio,processo,classe,fonte,execucao,projeto,ano,executor',
      returnGeometry: 'true',
      returnZ: 'false',
      returnM: 'false',
      geometryPrecision: '5',
      resultRecordCount: '50',
      orderByFields: 'objectid ASC',
    }).toString();
    const data = pageSchema.parse(await publicJson(url));
    const hasMore = data.exceededTransferLimit ?? data.properties?.exceededTransferLimit ?? false;
    for (const item of data.features) {
      const feature = normalizeSgbFeature(item.geometry, item.properties);
      const id = Number(feature.properties.sourceFeatureId);
      if (id <= after) throw new Error('SGB_INVALID_PAGE_ORDER');
      after = id;
      result.push(feature);
    }
    truncated = hasMore;
    if (!hasMore || data.features.length === 0) break;
  }
  return { features: result, truncated };
}
