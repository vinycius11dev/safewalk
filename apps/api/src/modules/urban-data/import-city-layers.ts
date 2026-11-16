import { parseArgs } from 'node:util';
import type { UrbanFeature } from '@safewalk/contracts';
import { signalsRegionBounds } from '../../integrations/urban/urban-bounds.js';
import {
  GEOSAMPA_CITY_POINT_SOURCES,
  OSM_SIGNAL_MUNICIPALITIES,
  fetchGeoSampaPoints,
  fetchOsmRegion,
} from '../../integrations/urban/city-layer-import.js';
import { saveImportedPoints } from './urban.repository.js';
import { pool } from '../../database/pool.js';

/**
 * Imports the point layers shown with the whole city on screen:
 * - GeoSampa: traffic signals (CET), flood history (SIGRC), police stations and hospitals;
 * - OpenStreetMap: traffic signals, police and hospitals of 13 neighboring municipalities.
 * Usage: npm run import:city-layers -w @safewalk/api [-- --skip-osm | --skip-geosampa]
 */
const args = parseArgs({
  options: {
    'skip-osm': { type: 'boolean', default: false },
    'skip-geosampa': { type: 'boolean', default: false },
  },
  strict: true,
});
const GEOSAMPA_RESOURCES = {
  'geosampa-crossings': { resourceId: 'geoportal:semaforo', label: 'GeoSampa · semáforos CET' },
  'geosampa-flood-history': {
    resourceId: 'geoportal:risco_ocorrencia_alagamento',
    label: 'GeoSampa · ocorrências de alagamento',
  },
  'geosampa-police': {
    resourceId: 'geoportal:equipamento_policia_civil',
    label: 'GeoSampa · delegacias',
  },
  'geosampa-health': {
    resourceId: 'geoportal:equipamento_saude_hospital',
    label: 'GeoSampa · hospitais',
  },
} as const;
const OSM_SOURCE = 'https://www.openstreetmap.org/copyright';

function saveOsm(sourceId: string, resourceId: string, features: UrbanFeature[]) {
  return saveImportedPoints({
    sourceId,
    resourceId,
    sourceUrl: OSM_SOURCE,
    publishedAt: null,
    bbox: signalsRegionBounds,
    rowsScanned: features.length,
    relevantRows: features.length,
    rowsWithoutCoordinates: 0,
    truncated: false,
    features,
  });
}

try {
  if (!args.values['skip-geosampa']) {
    for (const sourceId of GEOSAMPA_CITY_POINT_SOURCES) {
      const layer = await fetchGeoSampaPoints(sourceId);
      const saved = await saveImportedPoints({
        sourceId,
        resourceId: GEOSAMPA_RESOURCES[sourceId].resourceId,
        sourceUrl: 'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs',
        publishedAt: null,
        bbox: signalsRegionBounds,
        rowsScanned: layer.rowsScanned,
        relevantRows: layer.features.length,
        rowsWithoutCoordinates: layer.rowsWithoutCoordinates,
        truncated: false,
        features: layer.features,
      });
      console.info(JSON.stringify({ source: GEOSAMPA_RESOURCES[sourceId].label, ...saved }));
    }
  }
  if (!args.values['skip-osm']) {
    const osm = await fetchOsmRegion((municipality, found) =>
      console.info(JSON.stringify({ source: 'OpenStreetMap', municipality, ...found })),
    );
    const saved = {
      signals: await saveOsm('osm-signals', 'overpass:highway=traffic_signals', osm.signals),
      police: await saveOsm('osm-police', 'overpass:amenity=police', osm.police),
      hospitals: await saveOsm('osm-hospitals', 'overpass:amenity=hospital', osm.hospitals),
    };
    console.info(
      JSON.stringify({
        source: 'OpenStreetMap',
        municipalities: OSM_SIGNAL_MUNICIPALITIES.length,
        signals: saved.signals.featureCount,
        police: saved.police.featureCount,
        hospitals: saved.hospitals.featureCount,
      }),
    );
  }
} catch (error) {
  console.error(
    'Importação das camadas da cidade não concluída:',
    error instanceof Error ? error.message : 'UNKNOWN_ERROR',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
