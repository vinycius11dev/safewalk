import { z } from 'zod';
import { urbanFeatureSchema, type UrbanFeature } from '@safewalk/contracts';
import { urbanDefinitions } from './urban-catalog.js';
import { normalizeGeoSampaFeature } from './geosampa.js';
import { pointWithinBounds, signalsRegionBounds } from './urban-bounds.js';

/**
 * Offline import of point layers for the city-wide map (traffic signals and flood history).
 * Runs from the command line only, in sequence and with pauses, so the free public providers
 * receive a handful of requests.
 */
const USER_AGENT = 'SafeWalk/0.1 (importacao local de camadas da cidade)';
const GEOSAMPA_WFS = 'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const MAX_RESPONSE_BYTES = 40_000_000;

/** Municipalities around the capital whose signals come from OpenStreetMap. */
export const OSM_SIGNAL_MUNICIPALITIES = [
  'Taboão da Serra',
  'Embu das Artes',
  'Itapecerica da Serra',
  'Cotia',
  'Osasco',
  'Carapicuíba',
  'Barueri',
  'Guarulhos',
  'Santo André',
  'São Bernardo do Campo',
  'São Caetano do Sul',
  'Diadema',
  'Mauá',
] as const;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: URL, init: RequestInit = {}, timeoutMs = 90_000): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...init.headers },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await response.body?.cancel();
      await pause(5_000 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`SIGNALS_HTTP_${response.status}`);
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('SIGNALS_RESPONSE_TOO_LARGE');
    return JSON.parse(text) as unknown;
  }
  throw new Error('SIGNALS_PROVIDER_UNAVAILABLE');
}

/** Stored import rows are points; a MultiPoint signal keeps its first position. */
function asPoint(feature: UrbanFeature): UrbanFeature | null {
  const position =
    feature.geometry.type === 'Point'
      ? feature.geometry.coordinates
      : feature.geometry.type === 'MultiPoint'
        ? feature.geometry.coordinates[0]
        : undefined;
  if (!position || !pointWithinBounds(position[0], position[1], signalsRegionBounds)) return null;
  return { ...feature, geometry: { type: 'Point', coordinates: position } };
}

const wfsPageSchema = z.object({
  features: z.array(
    z.object({ geometry: z.unknown(), properties: z.record(z.string(), z.unknown()) }),
  ),
});

/** GeoSampa point layers that are imported whole for the city view. */
export const GEOSAMPA_CITY_POINT_SOURCES = [
  'geosampa-crossings',
  'geosampa-flood-history',
  'geosampa-police',
  'geosampa-health',
] as const;

/** A whole GeoSampa point layer (e.g. 6,4 mil semáforos; 292 ocorrências de alagamento). */
export async function fetchGeoSampaPoints(
  sourceId: (typeof GEOSAMPA_CITY_POINT_SOURCES)[number],
): Promise<{
  features: UrbanFeature[];
  rowsScanned: number;
  rowsWithoutCoordinates: number;
}> {
  const definition = urbanDefinitions.find((source) => source.id === sourceId);
  if (!definition?.wfsName || !definition.idField) throw new Error('URBAN_MISSING_DEFINITION');
  const pageSize = 1000;
  const features = new Map<string, UrbanFeature>();
  let rowsScanned = 0;
  let rowsWithoutCoordinates = 0;
  // O teto de 20 páginas evita laço infinito se a origem mudar.
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(GEOSAMPA_WFS);
    url.search = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: `geoportal:${definition.wfsName}`,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      maxFeatures: String(pageSize),
      startIndex: String(page * pageSize),
      sortBy: `${definition.idField} A`,
    }).toString();
    const data = wfsPageSchema.parse(await fetchJson(url));
    rowsScanned += data.features.length;
    for (const raw of data.features) {
      // Some registry rows have no geometry; they are counted, never placed on the map.
      const point = raw.geometry
        ? asPoint(normalizeGeoSampaFeature(definition, raw.geometry, raw.properties))
        : null;
      if (point) features.set(point.id, point);
      else rowsWithoutCoordinates += 1;
    }
    if (data.features.length < pageSize) break;
    await pause(1_000);
  }
  return { features: [...features.values()], rowsScanned, rowsWithoutCoordinates };
}

const overpassSchema = z.object({
  elements: z.array(
    z.object({
      type: z.enum(['node', 'way', 'relation']),
      id: z.number().int().positive(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      /** Ways and relations (e.g. a hospital drawn as a building) come with their center. */
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});
type OverpassElement = z.infer<typeof overpassSchema>['elements'][number];

const tag = (element: OverpassElement, key: string) => element.tags?.[key]?.slice(0, 120) ?? null;

function elementPosition(element: OverpassElement): [number, number] | null {
  const lon = element.lon ?? element.center?.lon;
  const lat = element.lat ?? element.center?.lat;
  if (lon === undefined || lat === undefined) return null;
  return pointWithinBounds(lon, lat, signalsRegionBounds) ? [lon, lat] : null;
}

export function osmSignalFeature(municipality: string, node: OverpassElement): UrbanFeature | null {
  const position = elementPosition(node);
  if (!position) return null;
  return urbanFeatureSchema.parse({
    type: 'Feature',
    id: `osm-signals:node/${node.id}`,
    geometry: { type: 'Point', coordinates: position },
    properties: {
      title: `Semáforo · ${municipality} (OpenStreetMap)`,
      type: 'crossings',
      category: 'crossing',
      sourceId: 'osm-signals',
      sourceFeatureId: `node/${node.id}`,
      observedAt: null,
      details: {
        currentConditionUnknown: true,
        sourceSurveyDate: null,
        municipality,
        signalType: tag(node, 'traffic_signals'),
        pedestrianCrossing: tag(node, 'crossing'),
        audibleSignal: tag(node, 'traffic_signals:sound'),
        operatingStatus: 'unknown',
        pedestrianAccessibility: 'not_assessed',
        collaborativeSource: true,
      },
    },
  });
}

/** Police station or hospital mapped in OpenStreetMap, without claiming opening hours or care. */
export function osmPlaceFeature(
  kind: 'police' | 'hospital',
  municipality: string,
  element: OverpassElement,
): UrbanFeature | null {
  const position = elementPosition(element);
  if (!position) return null;
  const sourceId = kind === 'police' ? 'osm-police' : 'osm-hospitals';
  const name = tag(element, 'name');
  const street = tag(element, 'addr:street');
  const number = tag(element, 'addr:housenumber');
  return urbanFeatureSchema.parse({
    type: 'Feature',
    id: `${sourceId}:${element.type}/${element.id}`,
    geometry: { type: 'Point', coordinates: position },
    properties: {
      title: `${kind === 'police' ? 'Polícia' : 'Hospital'} · ${name ?? municipality} (OpenStreetMap)`,
      type: kind === 'police' ? 'police' : 'health',
      category: 'safe-place',
      sourceId,
      sourceFeatureId: `${element.type}/${element.id}`,
      observedAt: null,
      details: {
        municipality,
        address: street ? `${street}${number ? `, ${number}` : ''}` : null,
        openingHours: tag(element, 'opening_hours'),
        ...(kind === 'police'
          ? { attendance: 'not_verified' }
          : { emergencyService: 'not_verified' }),
        safeWalkPartner: false,
        collaborativeSource: true,
      },
    },
  });
}

export type OsmRegion = {
  signals: UrbanFeature[];
  police: UrbanFeature[];
  hospitals: UrbanFeature[];
};

/** One Overpass query per municipality brings signals, police and hospitals together. */
export async function fetchOsmMunicipality(municipality: string): Promise<OsmRegion> {
  const name = municipality.replace(/["\\]/g, '');
  const query = `[out:json][timeout:150];area["boundary"="administrative"]["admin_level"="8"]["name"="${name}"]->.a;(node(area.a)["highway"="traffic_signals"];nwr(area.a)["amenity"="police"];nwr(area.a)["amenity"="hospital"];);out center;`;
  const data = overpassSchema.parse(
    await fetchJson(
      new URL(OVERPASS),
      {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      150_000,
    ),
  );
  const region: OsmRegion = { signals: [], police: [], hospitals: [] };
  for (const element of data.elements) {
    const amenity = element.tags?.amenity;
    const feature =
      amenity === 'police'
        ? osmPlaceFeature('police', municipality, element)
        : amenity === 'hospital'
          ? osmPlaceFeature('hospital', municipality, element)
          : element.type === 'node' && element.tags?.highway === 'traffic_signals'
            ? osmSignalFeature(municipality, element)
            : null;
    if (!feature) continue;
    if (amenity === 'police') region.police.push(feature);
    else if (amenity === 'hospital') region.hospitals.push(feature);
    else region.signals.push(feature);
  }
  return region;
}

export async function fetchOsmRegion(
  onProgress?: (municipality: string, found: Record<keyof OsmRegion, number>) => void,
): Promise<OsmRegion> {
  const merged = {
    signals: new Map<string, UrbanFeature>(),
    police: new Map<string, UrbanFeature>(),
    hospitals: new Map<string, UrbanFeature>(),
  };
  for (const municipality of OSM_SIGNAL_MUNICIPALITIES) {
    const found = await fetchOsmMunicipality(municipality);
    for (const key of ['signals', 'police', 'hospitals'] as const)
      for (const feature of found[key]) merged[key].set(feature.id, feature);
    onProgress?.(municipality, {
      signals: found.signals.length,
      police: found.police.length,
      hospitals: found.hospitals.length,
    });
    // Overpass pede intervalos entre consultas no servidor público.
    await pause(3_000);
  }
  return {
    signals: [...merged.signals.values()],
    police: [...merged.police.values()],
    hospitals: [...merged.hospitals.values()],
  };
}
