import { z } from 'zod';
import { urbanFeatureSchema, urbanGeometrySchema, type UrbanFeature } from '@safewalk/contracts';
import type { UrbanBounds } from './urban-bounds.js';
import type { UrbanDefinition } from './urban-catalog.js';
import { publicJson } from './public-http.js';

const collectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({ geometry: z.unknown(), properties: z.record(z.string(), z.unknown()) }),
  ),
  totalFeatures: z.union([z.number().nonnegative(), z.string()]).optional(),
});

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 250) : null;
}
function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function sourceDate(value: unknown): string | null {
  const date =
    typeof value === 'string' ? value.match(/^(\d{4}-\d{2}-\d{2})(?:Z|T.*)?$/)?.[1] : undefined;
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date)
    ? parsed.toISOString()
    : null;
}

export function normalizeGeoSampaFeature(
  definition: UrbanDefinition,
  geometry: unknown,
  p: Record<string, unknown>,
): UrbanFeature {
  const external = p[definition.idField ?? 'cd_identificador'];
  if (typeof external !== 'string' && typeof external !== 'number')
    throw new Error('URBAN_MISSING_EXTERNAL_ID');
  const sourceFeatureId = String(external).slice(0, 100);
  let title = definition.name;
  let category: UrbanFeature['properties']['category'] = 'other';
  let observedAt: string | null = null;
  const details: UrbanFeature['properties']['details'] = {
    currentConditionUnknown: true,
    sourceSurveyDate: null,
  };
  switch (definition.type) {
    case 'sidewalks':
      title = `Calçada · ${text(p.nm_logradouro) ?? 'logradouro não informado'}`;
      category = 'sidewalk';
      Object.assign(details, {
        minimumWidthMeters: number(p.qt_largura_minima_trecho),
        meanWidthMeters: number(p.qt_largura_media_trecho),
        maximumWidthMeters: number(p.qt_largura_maxima_trecho),
        minimumInclinePercent: number(p.pc_declividade_minima_trecho),
        meanInclinePercent: number(p.pc_declividade_media_trecho),
        maximumInclinePercent: number(p.pc_declividade_maxima_trecho),
        assessedAccessible: false,
        currentSurfaceCondition: 'unknown',
      });
      break;
    case 'lighting':
      title = `Iluminação cadastrada · ${text(p.tx_endereco) ?? text(p.dc_tipo_iluminacao_publica) ?? 'ponto'}`;
      category = 'lighting';
      Object.assign(details, {
        luminaireType: text(p.dc_tipo_iluminacao_publica),
        sourceLoadAt: sourceDate(p.dt_carga),
        operatingStatus: 'unknown',
      });
      break;
    case 'crossings':
      title = `Semáforo cadastrado · ${text(p.nm_endereco) ?? 'CET'}`;
      category = 'crossing';
      Object.assign(details, {
        signalType: text(p.dc_tipo_semaforo),
        sourceLoadAt: sourceDate(p.dt_carga),
        operatingStatus: 'unknown',
        pedestrianAccessibility: 'not_assessed',
      });
      break;
    case 'flood_history':
      title = 'Ocorrência histórica de alagamento';
      category = 'flood';
      observedAt = sourceDate(p.dt_ocorrencia);
      Object.assign(details, {
        eventStatus: 'historical',
        occurrenceType: text(p.dc_tipo_ocorrencia),
        districtAdministration: text(p.nm_subprefeitura),
        sourceLoadAt: sourceDate(p.dt_carga),
        liveFlood: false,
      });
      break;
    case 'flood_risk':
      title = `Mancha modelada · ${text(p.nm_bacia_hidrografica) ?? 'inundação'}`;
      category = 'flood';
      observedAt = sourceDate(p.dt_atualizacao);
      Object.assign(details, {
        modelUpdatedAt: observedAt,
        returnPeriodYears: number(p.qt_tempo_retorno),
        modelDepthMeters: number(p.qt_profundidade_maxima),
        modelAreaSquareMeters: number(p.qt_area_metro),
        liveFlood: false,
      });
      break;
    case 'accessibility':
      title = `Selo cadastrado · ${text(p.nm_estabelecimento) ?? 'estabelecimento'}`;
      Object.assign(details, {
        sealYear: number(p.an_selo),
        establishmentUse: text(p.tx_finalidade),
        address: text(p.tx_endereco),
        safeWalkPartner: false,
        routeAccessibility: 'not_assessed',
      });
      break;
    case 'health':
      title = `Saúde · ${text(p.nm_equipamento) ?? 'equipamento cadastrado'}`;
      category = 'safe-place';
      Object.assign(details, {
        equipmentType: text(p.nm_tipo_equipamento),
        address: text(p.tx_endereco_equipamento),
        openingHours: text(p.tx_horario_funcionamento),
        emergencyService: 'not_verified',
        safeWalkPartner: false,
      });
      break;
    case 'police':
      title = `Delegacia · ${text(p.nm_equipamento) ?? 'Polícia Civil'}`;
      category = 'safe-place';
      Object.assign(details, {
        equipmentType: text(p.nm_classe_equipamento),
        address: text(p.tx_endereco_equipamento),
        openingHours: text(p.tx_horario_funcionamento),
        attendance: 'not_verified',
        safeWalkPartner: false,
      });
      break;
  }
  return urbanFeatureSchema.parse({
    type: 'Feature',
    id: `${definition.id}:${sourceFeatureId}`,
    geometry: urbanGeometrySchema.parse(geometry),
    properties: {
      title: title.slice(0, 250),
      type: definition.type,
      category,
      sourceId: definition.id,
      sourceFeatureId,
      observedAt,
      details,
    },
  });
}

function geometryIntersectsBounds(geometry: UrbanFeature['geometry'], bbox: UrbanBounds): boolean {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  function visit(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      west = Math.min(west, value[0]);
      east = Math.max(east, value[0]);
      south = Math.min(south, value[1]);
      north = Math.max(north, value[1]);
    } else for (const child of value) visit(child);
  }
  visit(geometry.coordinates);
  // A transformed native-CRS BBOX may include a few candidates beyond its WGS84 edges.
  // Swapped axes/projected coordinates are a provider error; nearby outside candidates are filtered.
  if (!Number.isFinite(west) || west < -47.5 || east > -45.5 || south < -25 || north > -22.5)
    throw new Error('URBAN_GEOMETRY_INVALID_CRS');
  return west <= bbox[2] && east >= bbox[0] && south <= bbox[3] && north >= bbox[1];
}

export async function fetchGeoSampa(
  definition: UrbanDefinition,
  bbox: UrbanBounds,
): Promise<{
  features: UrbanFeature[];
  truncated: boolean;
  totalMatched: number | null;
  excludedOutsideBounds: number;
}> {
  if (!definition.wfsName) throw new Error('URBAN_UNKNOWN_LAYER');
  const features = new Map<string, UrbanFeature>();
  let totalMatched: number | null = null;
  let truncated = false;
  let excludedOutsideBounds = 0;
  let startIndex = 0;
  // At most three pages, each at most 150 candidates, and never more than 300 retained features.
  // The small third page can fill gaps left by native-CRS BBOX candidates outside the WGS84 area.
  for (let page = 0; page < 3 && features.size < 300; page += 1) {
    const pageSize = Math.min(150, 300 - features.size);
    const url = new URL('https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs');
    url.search = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: `geoportal:${definition.wfsName}`,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      bbox: `${bbox.join(',')},EPSG:4326`,
      maxFeatures: String(pageSize),
      startIndex: String(startIndex),
      sortBy: `${definition.idField} A`,
    }).toString();
    const data = collectionSchema.parse(await publicJson(url));
    startIndex += data.features.length;
    if (typeof data.totalFeatures === 'number') totalMatched = data.totalFeatures;
    for (const raw of data.features) {
      const feature = normalizeGeoSampaFeature(definition, raw.geometry, raw.properties);
      if (!geometryIntersectsBounds(feature.geometry, bbox)) {
        excludedOutsideBounds += 1;
        continue;
      }
      features.set(feature.id, feature);
    }
    if (data.features.length < pageSize || (totalMatched !== null && startIndex >= totalMatched))
      break;
    truncated = true;
  }
  truncated = totalMatched === null ? truncated : features.size < totalMatched;
  return { features: [...features.values()], truncated, totalMatched, excludedOutsideBounds };
}
