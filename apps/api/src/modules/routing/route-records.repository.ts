import type { RowDataPacket } from 'mysql2';
import type { RealRoute, RouteDayPeriod, RouteRecordsReading } from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import {
  recordBufferMeters,
  type CrimeCategory,
  type KnownRecord,
  type RouteRecordsCoverage,
} from '../../domain/route-records-score.js';

const metersPerLatitude = 111_320;
const metersPerLongitude = metersPerLatitude * Math.cos((-23.55 * Math.PI) / 180);
const queryLimit = 30_000;
const maximumBoxes = 24;
const boxMeters = 800;
const padMeters = Math.max(...Object.values(recordBufferMeters));

type Box = [number, number, number, number];

/** Caixas ao longo do percurso: evita ler o retângulo inteiro de uma rota na diagonal. */
export function corridorBoxes(route: RealRoute): Box[] {
  const coordinates = route.geometry.coordinates;
  const stride = Math.max(boxMeters, route.distanceMeters / maximumBoxes);
  const boxes: Box[] = [];
  let travelled = 0;
  const [firstLongitude, firstLatitude] = coordinates[0]!;
  let current: Box = [firstLongitude, firstLatitude, firstLongitude, firstLatitude];
  for (let index = 1; index < coordinates.length; index++) {
    const [longitude, latitude] = coordinates[index]!;
    const [lastLongitude, lastLatitude] = coordinates[index - 1]!;
    travelled += Math.hypot(
      (longitude - lastLongitude) * metersPerLongitude,
      (latitude - lastLatitude) * metersPerLatitude,
    );
    current = [
      Math.min(current[0], longitude),
      Math.min(current[1], latitude),
      Math.max(current[2], longitude),
      Math.max(current[3], latitude),
    ];
    if (travelled >= stride || index === coordinates.length - 1) {
      boxes.push(current);
      travelled = 0;
      // A caixa seguinte começa neste vértice para não deixar lacuna entre as duas.
      current = [longitude, latitude, longitude, latitude];
    }
  }
  const padX = padMeters / metersPerLongitude;
  const padY = padMeters / metersPerLatitude;
  return boxes
    .slice(0, maximumBoxes * 2)
    .map(([west, south, east, north]) => [west - padX, south - padY, east + padX, north + padY]);
}

function boxSql(
  boxes: Box[],
  longitude: string,
  latitude: string,
): { sql: string; values: number[] } {
  return {
    sql: boxes
      .map(() => `(${longitude} BETWEEN ? AND ? AND ${latitude} BETWEEN ? AND ?)`)
      .join(' OR '),
    values: boxes.flatMap(([west, south, east, north]) => [west, east, south, north]),
  };
}

type ImportRow = RowDataPacket & {
  id: string;
  source_url: string;
  completed_at: Date;
  expires_at: Date;
};
async function latestImport(sourceId: string): Promise<ImportRow | null> {
  const [rows] = await pool.execute<ImportRow[]>(
    `SELECT id, source_url, completed_at, expires_at FROM urban_imports
     WHERE source_id = ? ORDER BY completed_at DESC LIMIT 1`,
    [sourceId],
  );
  return rows[0] ?? null;
}
const importState = (row: ImportRow | null, now: Date): RouteRecordsCoverage['crime'] =>
  !row ? 'missing' : row.expires_at.getTime() <= now.getTime() ? 'stale' : 'available';

type CrimeRow = RowDataPacket & {
  longitude: number;
  latitude: number;
  category: CrimeCategory;
  occurred_on: string;
  period: RouteDayPeriod | null;
};
type CrashRow = RowDataPacket & {
  longitude: number;
  latitude: number;
  record_type: string | null;
  observed_at: string | null;
};
type ReportRow = RowDataPacket & {
  public_longitude: string;
  public_latitude: string;
  confirmations: number | string;
  not_found: number | string;
  resolved: number | string;
};

export type RouteRecords = {
  records: KnownRecord[];
  coverage: RouteRecordsCoverage;
  sources: RouteRecordsReading['sources'];
};

/** Lê somente tipo, data, período e coordenada: nenhum identificador de pessoa chega aqui. */
export async function findRouteRecords(route: RealRoute, now: Date): Promise<RouteRecords> {
  const boxes = corridorBoxes(route);
  const [crimeImport, crashImport] = await Promise.all([
    latestImport('ssp-crimes'),
    latestImport('infosiga'),
  ]);
  const crimeArea = boxSql(boxes, 'longitude', 'latitude');
  const crashArea = boxSql(boxes, 'f.longitude', 'f.latitude');
  const reportArea = boxSql(boxes, 'r.public_longitude', 'r.public_latitude');
  const [crimes, crashes, reports] = await Promise.all([
    crimeImport
      ? pool.query<CrimeRow[]>(
          `SELECT longitude, latitude, category, DATE_FORMAT(occurred_on, '%Y-%m-%d') AS occurred_on, period
           FROM crime_points WHERE import_id = ? AND (${crimeArea.sql}) LIMIT ${queryLimit + 1}`,
          [crimeImport.id, ...crimeArea.values],
        )
      : Promise.resolve([[] as CrimeRow[]] as const),
    crashImport
      ? pool.query<CrashRow[]>(
          `SELECT f.longitude, f.latitude,
             JSON_VALUE(f.feature_json, '$.properties.details.recordType') AS record_type,
             JSON_VALUE(f.feature_json, '$.properties.observedAt') AS observed_at
           FROM urban_import_features f
           WHERE f.import_id = ? AND (${crashArea.sql}) LIMIT ${queryLimit + 1}`,
          [crashImport.id, ...crashArea.values],
        )
      : Promise.resolve([[] as CrashRow[]] as const),
    pool.query<ReportRow[]>(
      `SELECT r.public_longitude, r.public_latitude,
         (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'present') AS confirmations,
         (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'not_found') AS not_found,
         (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'resolved') AS resolved
       FROM reports r JOIN users author ON author.id = r.user_id
       WHERE author.contribute_reports = 1 AND r.share_with_community = 1
         AND r.community_status = 'visible' AND r.status = 'active'
         AND r.expires_at > UTC_TIMESTAMP(3) AND (${reportArea.sql}) LIMIT 500`,
      reportArea.values,
    ),
  ]);
  const records: KnownRecord[] = [
    ...crimes[0].slice(0, queryLimit).map((row): KnownRecord => ({
      kind: 'crime',
      longitude: row.longitude,
      latitude: row.latitude,
      category: row.category,
      occurredOn: row.occurred_on,
      period: row.period,
    })),
    ...crashes[0].slice(0, queryLimit).flatMap((row): KnownRecord[] =>
      row.observed_at
        ? [
            {
              kind: 'pedestrian_crash',
              longitude: row.longitude,
              latitude: row.latitude,
              severity:
                row.record_type === 'SINISTRO FATAL'
                  ? 'fatal'
                  : row.record_type === 'SINISTRO NAO FATAL'
                    ? 'injury'
                    : 'notification',
              occurredOn: row.observed_at.slice(0, 10),
            },
          ]
        : [],
    ),
    ...reports[0].map((row): KnownRecord => ({
      kind: 'community_report',
      longitude: Number(row.public_longitude),
      latitude: Number(row.public_latitude),
      confirmations: Number(row.confirmations),
      notFound: Number(row.not_found),
      resolved: Number(row.resolved),
    })),
  ];
  const sources: RouteRecordsReading['sources'] = [];
  if (crimeImport)
    sources.push({
      name: 'SSP-SP · dados criminais',
      sourceUrl: crimeImport.source_url,
      importedAt: crimeImport.completed_at.toISOString(),
    });
  if (crashImport)
    sources.push({
      name: 'Infosiga · Detran-SP',
      sourceUrl: 'https://infosiga.detran.sp.gov.br/',
      importedAt: crashImport.completed_at.toISOString(),
    });
  return {
    records,
    coverage: {
      crime: importState(crimeImport, now),
      crashes: importState(crashImport, now),
      truncated: crimes[0].length > queryLimit || crashes[0].length > queryLimit,
    },
    sources,
  };
}
