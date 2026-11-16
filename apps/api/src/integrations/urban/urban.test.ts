import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeUrbanBounds,
  pilotBounds,
  sp156CityImportBounds,
  urbanBoundsSchema,
} from './urban-bounds.js';
import { validatePublicUrl, publicText } from './public-http.js';
import { fetchGeoSampa, normalizeGeoSampaFeature, sourceDate } from './geosampa.js';
import { urbanDefinitions } from './urban-catalog.js';
import { parseCgeSummary } from './cge.js';
import { csvRows, readSp156File, sp156CalendarDate } from './sp156.js';

test('Bbox mantém eixo longitude/latitude, limita área e agrupa deslocamentos pequenos', () => {
  const normalized = normalizeUrbanBounds([-46.661, -23.571, -46.639, -23.549]);
  assert.deepEqual(normalized, pilotBounds);
  assert.throws(() => normalizeUrbanBounds([-23.57, -46.66, -23.54, -46.63]));
  assert.throws(() => normalizeUrbanBounds([-46.8, -23.8, -46.4, -23.4]));
  assert.throws(() => normalizeUrbanBounds([NaN, -23.57, -46.63, -23.54]));
});

test('Provedores não aceitam SSRF, credenciais, HTTP, portas ou domínios parecidos', () => {
  for (const url of [
    'http://api.open-meteo.com/v1/forecast',
    'https://127.0.0.1/',
    'https://api.open-meteo.com.attacker.test/',
    'https://user:pass@api.open-meteo.com/',
    'https://api.open-meteo.com:8443/',
  ]) {
    assert.throws(() => validatePublicUrl(new URL(url)));
  }
  assert.doesNotThrow(() => validatePublicUrl(new URL('https://api.open-meteo.com/v1/forecast')));
});

test('HTTP público agrupa chamadas simultâneas, impõe limite do corpo e não segue redirect', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    calls += 1;
    assert.equal(init.redirect, 'error');
    return new Response('public-context', { status: 200 });
  });
  const url = new URL('https://api.open-meteo.com/unit-coalescing');
  const values = await Promise.all([publicText(url), publicText(url)]);
  assert.deepEqual(values, ['public-context', 'public-context']);
  assert.equal(calls, 1);
  await assert.rejects(
    publicText(new URL('https://api.open-meteo.com/unit-size-limit'), 3),
    /TOO_LARGE/,
  );
});

test('WFS pagina com limite, usa identificador estável e recusa CRS ou eixos inválidos', async (t) => {
  const definition = urbanDefinitions.find((source) => source.type === 'lighting');
  assert.ok(definition);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get('srsName'), 'EPSG:4326');
    assert.equal(url.searchParams.get('maxFeatures'), '150');
    const start = Number(url.searchParams.get('startIndex'));
    calls += 1;
    return Response.json({
      type: 'FeatureCollection',
      totalFeatures: 300,
      features: Array.from({ length: 150 }, (_, index) => ({
        id: `unstable-fid-${calls}-${index}`,
        geometry: { type: 'Point', coordinates: [-46.65, -23.56] },
        properties: { cd_identificador_iluminacao_publica: start + index },
      })),
    });
  });
  const result = await fetchGeoSampa(definition, pilotBounds);
  assert.equal(calls, 2);
  assert.equal(result.features.length, 300);
  assert.equal(result.truncated, false);
  assert.equal(result.features[0]?.id, 'geosampa-lighting:0');
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      type: 'FeatureCollection',
      totalFeatures: 1,
      features: [
        {
          geometry: { type: 'Point', coordinates: [-23.56, -46.65] },
          properties: { cd_identificador_iluminacao_publica: 1 },
        },
      ],
    }),
  );
  await assert.rejects(fetchGeoSampa(definition, pilotBounds), /GEOMETRY_INVALID_CRS/);
});

test('WFS conserva feições internas quando o bbox nativo também retorna candidatas externas próximas', async (t) => {
  const definition = urbanDefinitions.find((source) => source.type === 'sidewalks');
  assert.ok(definition);
  const bbox: [number, number, number, number] = [-46.655, -23.57, -46.645, -23.55];
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      type: 'FeatureCollection',
      totalFeatures: 2,
      features: [
        {
          geometry: { type: 'Point', coordinates: [-46.65, -23.56] },
          properties: { cd_identificador_calcada: 1 },
        },
        {
          geometry: { type: 'Point', coordinates: [-46.6449, -23.56] },
          properties: { cd_identificador_calcada: 2 },
        },
      ],
    }),
  );
  const result = await fetchGeoSampa(definition, bbox);
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0]?.properties.sourceFeatureId, '1');
  assert.equal(result.excludedOutsideBounds, 1);
  assert.equal(result.truncated, true);
});

test('WFS usa terceira página pequena para repor exclusões, mantendo teto de 300 feições', async (t) => {
  const definition = urbanDefinitions.find((source) => source.type === 'lighting');
  assert.ok(definition);
  const limits: number[] = [];
  const offsets: number[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const url = new URL(input);
    const start = Number(url.searchParams.get('startIndex'));
    const limit = Number(url.searchParams.get('maxFeatures'));
    limits.push(limit);
    offsets.push(start);
    return Response.json({
      type: 'FeatureCollection',
      totalFeatures: 500,
      features: Array.from({ length: limit }, (_, index) => ({
        geometry: {
          type: 'Point',
          coordinates: start + index === 49 ? [-46.6349, -23.56] : [-46.65, -23.56],
        },
        properties: { cd_identificador_iluminacao_publica: start + index },
      })),
    });
  });
  const result = await fetchGeoSampa(definition, pilotBounds);
  assert.equal(result.features.length, 300);
  assert.equal(result.excludedOutsideBounds, 1);
  assert.deepEqual(limits, [150, 150, 1]);
  assert.deepEqual(offsets, [0, 150, 300]);
  assert.equal(result.truncated, true);
});

test('GeoSampa preserva polígono, unidades e desconhecimento da condição atual', () => {
  const definition = urbanDefinitions.find((source) => source.type === 'sidewalks');
  assert.ok(definition);
  const feature = normalizeGeoSampaFeature(
    definition,
    {
      type: 'Polygon',
      coordinates: [
        [
          [-46.65, -23.56],
          [-46.651, -23.56],
          [-46.651, -23.561],
          [-46.65, -23.56],
        ],
      ],
    },
    {
      cd_identificador_calcada: 173558,
      nm_logradouro: 'RUA PÚBLICA',
      qt_largura_minima_trecho: 2.99,
      pc_declividade_media_trecho: 20.31,
      privateReporterEmail: 'not-retained@example.test',
    },
  );
  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.properties.details.minimumWidthMeters, 2.99);
  assert.equal(feature.properties.details.meanInclinePercent, 20.31);
  assert.equal(feature.properties.observedAt, null);
  assert.equal(feature.properties.details.sourceSurveyDate, null);
  assert.equal(feature.properties.details.currentSurfaceCondition, 'unknown');
  assert.equal(JSON.stringify(feature).includes('not-retained'), false);
  assert.equal(sourceDate('2026-10-21Z'), '2026-10-21T00:00:00.000Z');
  assert.equal(sourceDate('2026-02-31Z'), null);
});

test('Histórico e modelo de inundação nunca viram alagamento ativo', () => {
  for (const type of ['flood_history', 'flood_risk']) {
    const definition = urbanDefinitions.find((source) => source.type === type);
    assert.ok(definition);
    const feature = normalizeGeoSampaFeature(
      definition,
      { type: 'Point', coordinates: [-46.65, -23.56] },
      {
        cd_identificador: 2160,
        dt_ocorrencia: '2026-08-10Z',
        dt_atualizacao: '2026-08-10Z',
        qt_tempo_retorno: 5,
      },
    );
    assert.equal(feature.properties.details.liveFlood, false);
    assert.equal(feature.properties.details.currentConditionUnknown, true);
  }
});

test('CGE reconhece zero real e falha diante de layout incompleto', () => {
  const fixture =
    '<title>Alagamentos - CGE</title><input name="dataBusca" value="28/10/2026"><h1>Transitáveis = 0 pts</h1><h1>Intransitáveis = 1 pts</h1><h1>Transitáveis = 2 pts</h1><h1>Intransitáveis = 0 pts</h1>';
  const parsed = parseCgeSummary(fixture);
  assert.equal(parsed.activeImpassableForVehicles, 1);
  assert.equal(parsed.recordsWithoutCoordinates, 3);
  assert.equal(parsed.date, '2026-10-28');
  assert.throws(() => parseCgeSummary(fixture.replace('<h1>Transitáveis = 2 pts</h1>', '')));
  assert.throws(() => parseCgeSummary('<html>Erro temporário</html>'));
});

test('CSV em streaming lida com aspas, linhas internas, BOM e fronteiras de chunks', async () => {
  async function* chunks() {
    for (const character of '\uFEFFa,b\r\n"c,""d""","linha\ninterna"\r\n') yield character;
  }
  const rows = [];
  for await (const row of csvRows(chunks())) rows.push(row);
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['c,"d"', 'linha\ninterna'],
  ]);
  async function* broken() {
    yield 'a,"unterminated';
  }
  await assert.rejects(async () => {
    for await (const row of csvRows(broken())) void row;
  });
  assert.equal(sp156CalendarDate('07/25/2026'), '2026-07-25T00:00:00.000Z');
  assert.equal(sp156CalendarDate('02/31/2026'), null);
});

test('SP156 deduplica, usa só coordenada original e exclui identidade e ocorrências fora da área', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'safewalk-urban-'));
  const file = join(directory, 'public-synthetic.csv');
  const header =
    'Data de Abertura,Data de Finalização,Tema,Assunto,Serviço,Status,Logradouro,Número,Latitude,Longitude,Identidade do solicitante\n';
  const row =
    '07/25/2026,08/01/2026,Zeladoria,Calçada,Reparar calçada,Finalizada,RUA PÚBLICA,100,-23.56,-46.65,email-inexistente@example.test\n';
  try {
    await writeFile(
      file,
      header +
        row +
        row +
        row.replace('-23.56,-46.65', ',') +
        row.replace('-23.56,-46.65', '-23.9,-46.7'),
    );
    const result = await readSp156File(file, 'f67fcc12-8da4-485f-92a3-d2af40cc771e', pilotBounds);
    assert.equal(result.rowsScanned, 4);
    assert.equal(result.features.length, 1);
    assert.equal(result.rowsWithoutCoordinates, 1);
    assert.equal(result.features[0]?.properties.details.repaired, 'not_verified');
    assert.equal(JSON.stringify(result).includes('email-inexistente'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('importação municipal inclui outros bairros, mas mantém limite de consulta HTTP e sinaliza truncamento', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'safewalk-urban-'));
  const file = join(directory, 'public-synthetic.csv');
  const header =
    'Data de Abertura,Data de Finalização,Tema,Assunto,Serviço,Status,Logradouro,Número,Latitude,Longitude\n';
  const central =
    '07/25/2026,,Zeladoria,Calçada,Reparar calçada,Aberta,RUA PÚBLICA,100,-23.56,-46.65\n';
  const bairro =
    '07/25/2026,,Zeladoria,Calçada,Reparar calçada,Aberta,RUA PÚBLICA,200,-23.66,-46.75\n';
  try {
    await writeFile(file, header + central + bairro + bairro);
    const resource = 'f67fcc12-8da4-485f-92a3-d2af40cc771e';
    const pilot = await readSp156File(file, resource, pilotBounds);
    const city = await readSp156File(file, resource, sp156CityImportBounds);
    const capped = await readSp156File(file, resource, sp156CityImportBounds, 1);
    assert.equal(pilot.features.length, 1);
    assert.equal(city.features.length, 2);
    assert.equal(city.truncated, false);
    assert.equal(capped.features.length, 1);
    assert.equal(capped.truncated, true);
    assert.equal(urbanBoundsSchema.safeParse(sp156CityImportBounds).success, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
