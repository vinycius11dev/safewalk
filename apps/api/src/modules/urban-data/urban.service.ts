import { z } from 'zod';
import {
  urbanFeatureSchema,
  urbanFloodSummarySchema,
  urbanSourceSchema,
  urbanWeatherSchema,
  type UrbanFeature,
  type UrbanLayerType,
  type UrbanLayersResponse,
  type UrbanSource,
} from '@safewalk/contracts';
import {
  isWideBounds,
  normalizeRegionBounds,
  pilotBounds,
  type UrbanBounds,
} from '../../integrations/urban/urban-bounds.js';
import {
  urbanDefinitions,
  selectUrbanDefinitions,
  emptySource,
  type UrbanDefinition,
} from '../../integrations/urban/urban-catalog.js';
import { fetchGeoSampa } from '../../integrations/urban/geosampa.js';
import { fetchSgbSusceptibility } from '../../integrations/urban/sgb.js';
import { fetchCgeSummary } from '../../integrations/urban/cge.js';
import { fetchWeather } from '../../integrations/urban/open-meteo.js';
import { sampleUrbanFeatures } from '../../integrations/urban/feature-sampling.js';
import { getImportedInfosiga } from './infosiga.repository.js';
import {
  findCachedSnapshot,
  saveCachedSnapshot,
  recordProviderFailure,
  latestSourceSnapshots,
  intersectingSnapshots,
  getImportedSp156,
  getImportedPoints,
  type CacheEntry,
} from './urban.repository.js';

/** Up to this many imported points per source and response (the capital has 6,4 mil signals). */
const POINT_IMPORT_LIMIT = 9000;
const WIDE_RESPONSE_LIMIT = 16000;
const LIVE_RESPONSE_LIMIT = 4000;
/** Sources served from a local import when one exists (`npm run import:city-layers`). */
const IMPORTED_POINT_SOURCES = new Set([
  'geosampa-crossings',
  'osm-signals',
  'geosampa-flood-history',
  'geosampa-police',
  'osm-police',
  'geosampa-health',
  'osm-hospitals',
]);

const snapshotSchema = z.object({
  features: z.array(urbanFeatureSchema),
  source: urbanSourceSchema,
  truncated: z.boolean(),
  weather: urbanWeatherSchema.nullable(),
  floodSummary: urbanFloodSummarySchema.nullable(),
});
type Snapshot = z.infer<typeof snapshotSchema>;
const inflight = new Map<string, Promise<Snapshot>>();

function currentSnapshot(entry: CacheEntry | null, definition: UrbanDefinition): Snapshot {
  const parsed = snapshotSchema.safeParse(entry?.payload);
  const data: Snapshot = parsed.success
    ? parsed.data
    : {
        features: [],
        source: emptySource(definition),
        truncated: false,
        weather: null,
        floodSummary: null,
      };
  if (!parsed.success && entry?.failed) {
    data.source.status = 'unavailable';
    data.source.message += ' Origem indisponível; tente novamente mais tarde.';
  }
  if (parsed.success && entry) {
    data.source.status =
      entry.failed || !entry.expiresAt || Date.parse(entry.expiresAt) <= Date.now()
        ? 'stale'
        : 'available';
    if (entry.failed)
      data.source.message += ' A última atualização falhou; exibindo a última consulta válida.';
    if (data.floodSummary) {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (data.floodSummary.date !== today) data.source.status = 'stale';
    }
  }
  return data;
}

async function loadProvider(definition: UrbanDefinition, bbox: UrbanBounds): Promise<Snapshot> {
  const cacheBbox: UrbanBounds = definition.id === 'cge-floods' ? pilotBounds : bbox;
  const key = `${definition.id}:${cacheBbox.join(',')}`;
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;
  const operation = (async () => {
    const cached = await findCachedSnapshot(key);
    if (
      cached &&
      Date.parse(cached.retryAfter) > Date.now() &&
      (!cached.payload || snapshotSchema.safeParse(cached.payload).success)
    )
      return currentSnapshot(cached, definition);
    try {
      const now = new Date();
      let features: UrbanFeature[] = [];
      let truncated = false;
      let totalMatched: number | null = null;
      let excludedOutsideBounds = 0;
      let weather: Snapshot['weather'] = null;
      let floodSummary: Snapshot['floodSummary'] = null;
      if (definition.wfsName) {
        const response = await fetchGeoSampa(definition, bbox);
        features = response.features;
        truncated = response.truncated;
        totalMatched = response.totalMatched;
        excludedOutsideBounds = response.excludedOutsideBounds;
      } else if (definition.id === 'sgb-flood-susceptibility') {
        const response = await fetchSgbSusceptibility(bbox);
        features = response.features;
        truncated = response.truncated;
      } else if (definition.id === 'cge-floods') floodSummary = await fetchCgeSummary();
      else if (definition.id === 'open-meteo') weather = await fetchWeather(bbox);
      const asOf = floodSummary
        ? `${floodSummary.date}T00:00:00.000Z`
        : (weather?.observedAt ??
          features
            .map((feature) => feature.properties.observedAt)
            .filter((value): value is string => value !== null)
            .sort()
            .at(-1) ??
          null);
      const snapshot: Snapshot = {
        features,
        truncated,
        weather,
        floodSummary,
        source: {
          ...emptySource(definition),
          status: 'available',
          fetchedAt: now.toISOString(),
          asOf,
          expiresAt: new Date(now.getTime() + definition.ttlSeconds * 1000).toISOString(),
          featureCount: features.length,
          coverage:
            definition.id === 'cge-floods'
              ? 'Resumo municipal da data indicada; sem localização individual verificada.'
              : `${definition.id.startsWith('geosampa-') ? 'GeoSampa reúne dados municipais de São Paulo e não garante cobertura dos municípios vizinhos, inclusive Taboão da Serra. ' : ''}Área consultada EPSG:4326: ${bbox.join(', ')}. ${features.length} feições recebidas${totalMatched !== null ? ` de ${totalMatched} candidatas na origem` : ''}${truncated ? '; amostra parcial limitada por paginação' : ''}.${excludedOutsideBounds ? ` ${excludedOutsideBounds} candidatas fora dos limites WGS84 foram excluídas após transformação do CRS da consulta.` : ''}`,
        },
      };
      await saveCachedSnapshot({
        key,
        sourceId: definition.id,
        bbox: cacheBbox,
        payload: snapshot,
        ttlSeconds: definition.ttlSeconds,
      });
      return currentSnapshot(await findCachedSnapshot(key), definition);
    } catch {
      await recordProviderFailure(key, definition.id, cacheBbox);
      const snapshot = currentSnapshot(cached, definition);
      snapshot.source.status = cached?.payload ? 'stale' : 'unavailable';
      snapshot.source.message += cached?.payload
        ? ' Falha ao atualizar; último resultado válido preservado.'
        : ' Origem indisponível ou resposta inválida; isso não significa ausência de ocorrências.';
      return snapshot;
    }
  })();
  inflight.set(key, operation);
  void operation.finally(() => inflight.delete(key)).catch(() => undefined);
  return operation;
}

async function sp156Snapshot(bbox?: UrbanBounds): Promise<Snapshot> {
  const definition = urbanDefinitions.find((source) => source.id === 'sp156');
  if (!definition) throw new Error('URBAN_MISSING_DEFINITION');
  const result = await getImportedSp156(bbox, Boolean(bbox));
  if (!result)
    return {
      features: [],
      source: emptySource(definition),
      truncated: false,
      weather: null,
      floodSummary: null,
    };
  const imported = result.imported;
  const extendsCoverage =
    bbox &&
    (bbox[0] < imported.west ||
      bbox[1] < imported.south ||
      bbox[2] > imported.east ||
      bbox[3] > imported.north);
  return {
    features: result.features,
    weather: null,
    floodSummary: null,
    truncated: result.truncated || Boolean(extendsCoverage),
    source: {
      ...emptySource(definition),
      sourceUrl: imported.source_url,
      status: imported.expires_at.getTime() <= Date.now() ? 'stale' : 'available',
      fetchedAt: imported.completed_at.toISOString(),
      asOf: imported.published_at?.toISOString() ?? null,
      expiresAt: imported.expires_at.toISOString(),
      featureCount: bbox ? result.features.length : imported.feature_count,
      coverage: `Importação restrita a ${[imported.west, imported.south, imported.east, imported.north].join(', ')}; ${imported.feature_count} solicitações georreferenciadas deduplicadas. ${imported.rows_scanned} linhas lidas; ${imported.rows_without_coordinates} solicitações relevantes sem coordenadas originais excluídas do mapa.${extendsCoverage ? ' A área consultada excede a importada.' : ''}`,
      message: `${definition.message} Publicação do recurso: ${imported.published_at?.toISOString().slice(0, 10) ?? 'não informada'}. Limite por resposta: 1.000 feições. Sem identificador público de protocolo neste CSV; duplicatas exatas são agrupadas por hash.`,
    },
  };
}

function importCoverage(sourceId: string, count: number): string {
  if (sourceId === 'osm-signals')
    return `Importação de ${count} semáforos mapeados por voluntários em municípios vizinhos à capital. Cadastro colaborativo: pode faltar semáforo ou haver posição desatualizada.`;
  if (sourceId === 'osm-police' || sourceId === 'osm-hospitals')
    return `Importação de ${count} ${sourceId === 'osm-police' ? 'locais de polícia' : 'hospitais'} mapeados por voluntários em municípios vizinhos à capital. Cadastro colaborativo: pode faltar local ou haver informação desatualizada.`;
  if (sourceId === 'geosampa-police')
    return `Importação da capital inteira: ${count} delegacias da Polícia Civil cadastradas. Horário e plantão não verificados; não cobre municípios vizinhos.`;
  if (sourceId === 'geosampa-health')
    return `Importação da capital inteira: ${count} hospitais cadastrados. Pronto-socorro e horário não verificados; não cobre municípios vizinhos.`;
  if (sourceId === 'geosampa-flood-history')
    return `Importação da capital inteira: ${count} ocorrências históricas de alagamento registradas pela Defesa Civil (SIGRC). Não indica alagamento agora nem cobre municípios vizinhos.`;
  return `Importação da capital inteira: ${count} semáforos cadastrados pela CET. Não cobre municípios vizinhos.`;
}

/**
 * Point layers imported for the whole city. Returns null when the source has no import, so
 * GeoSampa falls back to the live (paginated) query; OpenStreetMap stays "not configured".
 */
async function importedPointsSnapshot(
  definition: UrbanDefinition,
  bbox?: UrbanBounds,
): Promise<Snapshot | null> {
  const result = await getImportedPoints(definition.id, bbox, Boolean(bbox), POINT_IMPORT_LIMIT);
  if (!result) return null;
  const { imported } = result;
  return {
    features: result.features,
    weather: null,
    floodSummary: null,
    truncated: result.truncated,
    source: {
      ...emptySource(definition),
      sourceUrl: definition.sourceUrl,
      status: imported.expires_at.getTime() <= Date.now() ? 'stale' : 'available',
      fetchedAt: imported.completed_at.toISOString(),
      asOf: imported.published_at?.toISOString() ?? null,
      expiresAt: imported.expires_at.toISOString(),
      featureCount: bbox ? result.features.length : imported.feature_count,
      coverage: importCoverage(definition.id, imported.feature_count),
    },
  };
}

async function infosigaSnapshot(bbox?: UrbanBounds): Promise<Snapshot> {
  const definition = urbanDefinitions.find((source) => source.id === 'infosiga');
  if (!definition) throw new Error('URBAN_MISSING_DEFINITION');
  const result = await getImportedInfosiga(bbox, Boolean(bbox));
  if (!result)
    return {
      features: [],
      source: emptySource(definition),
      truncated: false,
      weather: null,
      floodSummary: null,
    };
  const { imported } = result;
  const extendsCoverage =
    bbox &&
    (bbox[0] < imported.west ||
      bbox[1] < imported.south ||
      bbox[2] > imported.east ||
      bbox[3] > imported.north);
  return {
    features: result.features,
    weather: null,
    floodSummary: null,
    truncated: result.truncated || Boolean(extendsCoverage),
    source: {
      ...emptySource(definition),
      sourceUrl: imported.source_url,
      status: imported.expires_at.getTime() <= Date.now() ? 'stale' : 'available',
      fetchedAt: imported.completed_at.toISOString(),
      asOf: imported.published_at?.toISOString() ?? null,
      expiresAt: imported.expires_at.toISOString(),
      featureCount: bbox ? result.features.length : imported.feature_count,
      coverage: `Base estadual, registros de 2014 a 2026 no conjunto importado; disponibilidade efetiva varia no tempo e no município. O aplicativo consulta apenas a região operacional de São Paulo. ${imported.feature_count} registros com coordenadas originais e precisão desconhecida; ${imported.rows_without_coordinates} sem coordenadas excluídos. Limite de 1.000 pontos por consulta.${extendsCoverage ? ' A área consultada excede a faixa importada.' : ''}`,
    },
  };
}

function assemble(
  snapshots: Snapshot[],
  bbox: UrbanBounds,
  limit = LIVE_RESPONSE_LIMIT,
): UrbanLayersResponse {
  const features = new Map<string, UrbanFeature>();
  const sources = new Map<string, UrbanSource>();
  for (const snapshot of snapshots) {
    if (!sources.has(snapshot.source.id)) sources.set(snapshot.source.id, snapshot.source);
    for (const feature of snapshot.features) features.set(feature.id, feature);
  }
  return {
    type: 'FeatureCollection',
    features: sampleUrbanFeatures(features.values(), limit),
    sources: [...sources.values()],
    bbox,
    truncated: snapshots.some((snapshot) => snapshot.truncated) || features.size > limit,
    generatedAt: new Date().toISOString(),
    coverageWarnings: [
      'Dados cadastrais, históricos e modelados não comprovam segurança ou acessibilidade atual. Ausência de registro não comprova ausência de risco.',
      ...(snapshots.some((snapshot) => snapshot.truncated)
        ? [
            'Cobertura parcial: há limites de paginação ou área importada. A amostra não representa todos os obstáculos.',
          ]
        : []),
      ...snapshots
        .filter((snapshot) => snapshot.source.status !== 'available')
        .map(
          (snapshot) =>
            `${snapshot.source.name}: ${snapshot.source.status === 'stale' ? 'dados vencidos ou atualização indisponível' : snapshot.source.status === 'not_configured' ? 'importação não configurada' : 'origem indisponível'}.`,
        ),
    ],
    weather:
      snapshots
        .flatMap((snapshot) => (snapshot.weather ? [snapshot.weather] : []))
        .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0] ?? null,
    floodSummary: snapshots.find((snapshot) => snapshot.floodSummary)?.floodSummary ?? null,
  };
}

export async function getUrbanLayers(input: {
  bbox: UrbanBounds;
  types?: UrbanLayerType[];
}): Promise<UrbanLayersResponse> {
  const bbox = normalizeRegionBounds(input.bbox);
  // A city-wide view reads only local imports (and the municipal flood/weather summaries):
  // live layers such as sidewalks would mean dozens of provider calls for one screen.
  const wide = isWideBounds(bbox);
  const selected = selectUrbanDefinitions(input.types);
  const skipped: string[] = [];
  const snapshots = await Promise.all(
    selected.map(async (definition): Promise<Snapshot | null> => {
      if (definition.id === 'sp156') return sp156Snapshot(bbox);
      if (definition.id === 'infosiga') return infosigaSnapshot(bbox);
      if (IMPORTED_POINT_SOURCES.has(definition.id)) {
        const imported = await importedPointsSnapshot(definition, bbox);
        if (imported) return imported;
        if (definition.id === 'osm-signals')
          return {
            features: [],
            source: emptySource(definition),
            truncated: false,
            weather: null,
            floodSummary: null,
          };
      }
      if (wide && definition.id !== 'cge-floods' && definition.id !== 'open-meteo') {
        skipped.push(definition.name);
        return null;
      }
      return loadProvider(definition, bbox);
    }),
  );
  const result = assemble(
    snapshots.filter((snapshot): snapshot is Snapshot => snapshot !== null),
    bbox,
    wide ? WIDE_RESPONSE_LIMIT : LIVE_RESPONSE_LIMIT,
  );
  if (skipped.length)
    result.coverageWarnings.push(
      `Visão ampliada: aproxime o mapa para carregar ${skipped.join(', ')}.`,
    );
  return result;
}

/** Routing can read context without dispatching any new external requests. Coverage is always partial. */
export async function getCachedUrbanContext(bbox: UrbanBounds): Promise<UrbanLayersResponse> {
  // Internal routing reads may cover a longer walk. No network requests or larger provider bboxes.
  const validated = z
    .tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ])
    .refine(
      ([west, south, east, north]) =>
        west < east && south < north && east - west < 5 && north - south < 5,
    )
    .parse(bbox);
  const cached = await intersectingSnapshots(validated);
  const snapshots = cached.flatMap((entry) => {
    const definition = urbanDefinitions.find((source) => source.id === entry.sourceId);
    // InfoSiga coordinates have unknown precision and cannot support a 50 m proximity claim.
    return definition && definition.id !== 'infosiga' ? [currentSnapshot(entry, definition)] : [];
  });
  snapshots.push(await sp156Snapshot(validated));
  for (const definition of urbanDefinitions.filter((item) => IMPORTED_POINT_SOURCES.has(item.id))) {
    const imported = await importedPointsSnapshot(definition, validated);
    if (imported) snapshots.push(imported);
  }
  const result = assemble(snapshots, validated);
  result.truncated = true;
  result.coverageWarnings.push(
    'Contexto de rota usa somente consultas já armazenadas e pode ter lacunas; não é uma avaliação de segurança.',
  );
  return result;
}

export async function getUrbanSources() {
  const cached = await latestSourceSnapshots();
  const sources = await Promise.all(
    urbanDefinitions.map(async (definition) => {
      if (definition.id === 'sp156') return (await sp156Snapshot()).source;
      if (definition.id === 'infosiga') return (await infosigaSnapshot()).source;
      if (IMPORTED_POINT_SOURCES.has(definition.id)) {
        const imported = await importedPointsSnapshot(definition);
        if (imported) return imported.source;
      }
      return currentSnapshot(
        cached.find((entry) => entry.sourceId === definition.id) ?? null,
        definition,
      ).source;
    }),
  );
  return { sources, generatedAt: new Date().toISOString() };
}
