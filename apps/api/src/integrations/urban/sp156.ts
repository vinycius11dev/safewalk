import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { urbanFeatureSchema, type UrbanFeature } from '@safewalk/contracts';
import { pointWithinBounds, type UrbanBounds } from './urban-bounds.js';
import { publicJson, validatePublicUrl } from './public-http.js';

const catalogSchema = z.object({
  success: z.literal(true),
  result: z.object({
    license_id: z.string(),
    resources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        url: z.url(),
        last_modified: z.string().nullable().optional(),
        format: z.string(),
      }),
    ),
  }),
});

export async function getSp156Resource(resourceId: string) {
  const url = new URL(
    'https://dados.prefeitura.sp.gov.br/api/3/action/package_show?id=dados-do-sp156',
  );
  const catalog = catalogSchema.parse(await publicJson(url));
  const resource = catalog.result.resources.find((item) => item.id === resourceId);
  if (!resource || !/Dados do SP156/i.test(resource.name) || !/csv/i.test(resource.format))
    throw new Error('URBAN_SP156_RESOURCE_NOT_FOUND');
  const download = new URL(resource.url);
  validatePublicUrl(download);
  if (
    download.hostname !== 'dados.prefeitura.sp.gov.br' ||
    !download.pathname.startsWith('/dataset/')
  )
    throw new Error('URBAN_SP156_RESOURCE_URL');
  return {
    ...resource,
    license: catalog.result.license_id,
    publishedAt: resource.last_modified
      ? new Date(`${resource.last_modified.replace(/Z$/, '')}Z`).toISOString()
      : null,
  };
}

/** RFC4180-style streaming state machine: escaped quotes, quoted newlines, CRLF and bounded fields. */
export async function* csvRows(chunks: AsyncIterable<string>): AsyncGenerator<string[]> {
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let skipLineFeed = false;
  let first = true;
  for await (const chunk of chunks) {
    for (const character of chunk) {
      if (first) {
        first = false;
        if (character === '\uFEFF') continue;
      }
      if (skipLineFeed) {
        skipLineFeed = false;
        if (character === '\n') continue;
      }
      if (quoted) {
        if (character === '"') {
          quoted = false;
          afterQuote = true;
        } else field += character;
      } else if (afterQuote && character === '"') {
        field += '"';
        quoted = true;
        afterQuote = false;
      } else {
        if (afterQuote && character !== ',' && character !== '\n' && character !== '\r')
          throw new Error('URBAN_CSV_INVALID_QUOTE');
        afterQuote = false;
        if (character === '"') {
          if (field.length) throw new Error('URBAN_CSV_INVALID_QUOTE');
          quoted = true;
        } else if (character === ',') {
          row.push(field);
          field = '';
        } else if (character === '\n' || character === '\r') {
          row.push(field);
          field = '';
          if (character === '\r') skipLineFeed = true;
          if (row.some((value) => value.length > 0)) yield row;
          row = [];
        } else field += character;
      }
      if (field.length > 16_000 || row.length > 40) throw new Error('URBAN_CSV_ROW_TOO_LARGE');
    }
  }
  if (quoted) throw new Error('URBAN_CSV_UNTERMINATED_QUOTE');
  if (field.length || row.length) {
    row.push(field);
    yield row;
  }
}

/** This published resource uses MM/DD/YYYY, as confirmed by unambiguous 07/25/2026 records. */
export function sp156CalendarDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString()
    : null;
}
const requiredHeaders = [
  'Data de Abertura',
  'Data de Finalização',
  'Tema',
  'Assunto',
  'Serviço',
  'Status',
  'Logradouro',
  'Número',
  'Latitude',
  'Longitude',
];
const relevantServices =
  /cal[cç]ada|buraco|pavimenta|ilumina[cç]|alagamento|enchente|bueiro|boca de lobo|rampa|semaf[oó]ro|sinaliza[cç][aã]o|acessibilidade|deslizamento|[aá]rvore.*(?:ca[ií]da|queda)|obstru[cç][aã]o/i;

export async function readSp156File(
  path: string,
  resourceId: string,
  bbox: UrbanBounds,
  maxFeatures = 100_000,
) {
  if (!Number.isInteger(maxFeatures) || maxFeatures < 1 || maxFeatures > 100_000)
    throw new Error('URBAN_SP156_INVALID_FEATURE_LIMIT');
  const file = await stat(path);
  if (!file.isFile() || file.size > 150_000_000) throw new Error('URBAN_SP156_FILE_LIMIT_150MB');
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  async function* boundedChunks(): AsyncGenerator<string> {
    let bytes = 0;
    for await (const chunk of stream) {
      if (typeof chunk !== 'string') throw new Error('URBAN_SP156_INVALID_ENCODING');
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > 150_000_000) throw new Error('URBAN_SP156_FILE_LIMIT_150MB');
      yield chunk;
    }
  }
  let headers: string[] | null = null;
  let rowsScanned = 0;
  let relevantRows = 0;
  let rowsWithoutCoordinates = 0;
  let truncated = false;
  const features = new Map<string, UrbanFeature>();
  for await (const values of csvRows(boundedChunks())) {
    if (!headers) {
      headers = values.map((value) => value.trim());
      if (requiredHeaders.some((header) => !headers?.includes(header)))
        throw new Error('URBAN_SP156_SCHEMA_CHANGED');
      continue;
    }
    rowsScanned += 1;
    if (values.length !== headers.length) throw new Error('URBAN_SP156_COLUMN_MISMATCH');
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    );
    const service = record['Serviço'] ?? '';
    if (!relevantServices.test(`${record.Tema} ${record.Assunto} ${service}`)) continue;
    relevantRows += 1;
    const latitude = record.Latitude?.trim() ? Number(record.Latitude.replace(',', '.')) : NaN;
    const longitude = record.Longitude?.trim() ? Number(record.Longitude.replace(',', '.')) : NaN;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude === 0 ||
      longitude === 0
    ) {
      rowsWithoutCoordinates += 1;
      continue;
    }
    if (!pointWithinBounds(longitude, latitude, bbox)) continue;
    const observedAt = sp156CalendarDate(record['Data de Abertura'] ?? '');
    if (!observedAt) throw new Error('URBAN_SP156_UNKNOWN_DATE_FORMAT');
    // Whitelist only service/address data. No reporter identity, free text or contact information is retained.
    const details = {
      service: service.slice(0, 250),
      subject: (record.Assunto ?? '').slice(0, 250),
      status: (record.Status ?? '').slice(0, 100),
      street: (record.Logradouro ?? '').slice(0, 250),
      streetNumber: (record['Número'] ?? '').slice(0, 30),
      closedAt: sp156CalendarDate(record['Data de Finalização'] ?? ''),
      currentConditionUnknown: true,
      datePrecision: 'calendar_date',
      originalCoordinate: true,
      repaired: 'not_verified',
    };
    const sourceFeatureId = `${resourceId}:${createHash('sha256').update(JSON.stringify({ observedAt, latitude, longitude, details })).digest('hex')}`;
    const category: UrbanFeature['properties']['category'] =
      /alag|enchent|bueir|boca de lobo/i.test(service)
        ? 'flood'
        : /ilumina/i.test(service)
          ? 'lighting'
          : /semaf|sinaliza/i.test(service)
            ? 'crossing'
            : /cal[cç]ada|rampa|acessibilidade/i.test(service)
              ? 'sidewalk'
              : 'other';
    if (features.size >= maxFeatures && !features.has(sourceFeatureId)) {
      truncated = true;
      continue;
    }
    features.set(
      sourceFeatureId,
      urbanFeatureSchema.parse({
        type: 'Feature',
        id: `sp156:${sourceFeatureId}`,
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: {
          sourceId: 'sp156',
          sourceFeatureId,
          title: `Solicitação SP156 · ${service}`.slice(0, 250),
          type: 'sp156',
          category,
          observedAt,
          details,
        },
      }),
    );
  }
  if (!headers || !rowsScanned) throw new Error('URBAN_SP156_EMPTY_FILE');
  return {
    features: [...features.values()],
    rowsScanned,
    relevantRows,
    rowsWithoutCoordinates,
    truncated,
  };
}
