import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  routingRequestSchema,
  realRouteSchema,
  type UrbanFeature,
  type UrbanLayersResponse,
} from '@safewalk/contracts';
import { parsePhoton } from '../src/integrations/routing/photon.js';
import { resolveSearchAlias, searchAlias } from '../src/integrations/routing/place-aliases.js';
import {
  parseValhalla,
  decodePolyline6,
  buildValhallaRequest,
  valhallaManeuver,
} from '../src/integrations/routing/valhalla.js';
import { AppError } from '../src/middleware/errors.js';
import { attachCachedContext } from '../src/modules/routing/route-context.js';
import {
  assessRouteFlood,
  markLowerKnownFloodExposure,
  withFloodAssessment,
} from '../src/modules/routing/route-flood-assessment.js';
import {
  filterRouteContext,
  routeContextBoxes,
} from '../src/modules/routing/route-context-plan.js';
import { geographicJson } from '../src/integrations/routing/external-http.js';
import { photonOrigin } from '../src/integrations/routing/providers.js';

const readFixture = async (name: string): Promise<unknown> =>
  JSON.parse(
    await readFile(new URL(`./fixtures/routing/${name}.json`, import.meta.url), 'utf8'),
  ) as unknown;
const input = routingRequestSchema.parse({
  origin: { latitude: -23.5641, longitude: -46.6521 },
  destination: { latitude: -23.5535, longitude: -46.6527 },
  destinationLabel: 'Shopping Frei Caneca',
});
test('carro exige resposta drive e preserva restrições de circulação', async () => {
  const driving = routingRequestSchema.parse({
    ...input,
    profile: 'auto',
    preference: 'step_free',
  });
  const request = buildValhallaRequest(driving);
  assert.equal(request.costing, 'auto');
  assert.deepEqual(request.costing_options, {
    auto: { ignore_restrictions: false, ignore_oneways: false, ignore_access: false },
  });
  const fixture = await readFixture('valhalla-paulista-frei-caneca');
  assert.throws(() => parseValhalla(fixture, driving));
  const payload = JSON.parse(
    JSON.stringify(fixture).replaceAll('"travel_mode":"pedestrian"', '"travel_mode":"drive"'),
  );
  const route = parseValhalla(payload, driving)[0]!;
  assert.equal(route.profile, 'auto');
  assert.equal(route.preference, 'standard');
  assert.throws(() => parseValhalla(payload, input));
});
test('FIAP Paulista usa endereço oficial e só aceita coordenadas de resultado com o número correto', () => {
  const alias = searchAlias('  FIAP   Paulista ');
  assert.deepEqual(alias, { kind: 'fiap-paulista', providerQuery: 'Avenida Paulista 1106' });
  assert.equal(searchAlias('FIAP Aclimação'), null);
  const places = parsePhoton({
    type: 'FeatureCollection',
    features: [
      {
        geometry: { type: 'Point', coordinates: [-46.7, -23.56] },
        properties: { osm_type: 'N', osm_id: 2, street: 'Avenida Paulista', housenumber: '1100' },
      },
      {
        geometry: { type: 'Point', coordinates: [-46.6527132, -23.564324] },
        properties: {
          osm_type: 'N',
          osm_id: 3,
          name: 'Outro estabelecimento',
          street: 'Avenida Paulista',
          housenumber: '1106',
        },
      },
    ],
  });
  const result = resolveSearchAlias(places, 'fiap-paulista');
  assert.equal(result.length, 1);
  assert.equal(result[0]?.name, 'FIAP Paulista');
  assert.equal(result[0]?.location.longitude, -46.6527132);
  assert.match(result[0]?.attribution ?? '', /FIAP/);
  assert.match(result[0]?.address ?? '', /Ponto aproximado/);
  assert.deepEqual(resolveSearchAlias(places.slice(0, 1), 'fiap-paulista'), []);
});
test('Photon preserva coordenadas GeoJSON e normaliza a extensão invertida norte/sul', async () => {
  const places = parsePhoton(await readFixture('photon-frei-caneca'));
  assert.ok(places.length > 0);
  assert.equal(places[0]?.name, 'Shopping Frei Caneca');
  assert.equal(places[0]?.location.latitude, -23.55418);
  assert.equal(places[0]?.location.longitude, -46.6524036);
  const bounds = places[0]?.bounds;
  assert.ok(bounds && bounds[0] < bounds[2] && bounds[1] < bounds[3]);
  assert.throws(
    () =>
      parsePhoton({
        type: 'FeatureCollection',
        features: [{ geometry: { type: 'Point', coordinates: [200, -23] }, properties: {} }],
      }),
    AppError,
  );
});
test('Photon retorna um único local para o mesmo objeto OSM com categorias diferentes', () => {
  const point = { type: 'Point', coordinates: [-46.6346871, -23.5475552] };
  const duplicate = {
    osm_type: 'N',
    osm_id: 4973028945,
    name: 'Centro Cultural Banco do Brasil São Paulo',
  };
  const result = parsePhoton({
    type: 'FeatureCollection',
    features: [
      { geometry: point, properties: { ...duplicate, osm_value: 'arts_centre' } },
      { geometry: point, properties: { ...duplicate, osm_value: 'museum' } },
      { geometry: point, properties: { ...duplicate, osm_id: 100, osm_value: 'museum' } },
    ],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0]?.id, 'photon:N:4973028945');
  assert.equal(result[0]?.category, 'arts_centre');
  assert.equal(result[1]?.id, 'photon:N:100');
});
test('Valhalla público calcula percurso pedestre, alternativas reais e polilinha6 em São Paulo', async () => {
  const now = new Date('2026-10-28T15:00:00.000Z');
  const options = parseValhalla(await readFixture('valhalla-paulista-frei-caneca'), input, now);
  assert.ok(options.length >= 1 && options.length <= 3);
  for (const option of options) {
    realRouteSchema.parse(option);
    assert.equal(option.simulated, false);
    assert.equal(option.profile, 'pedestrian');
    assert.equal(option.riskLabel, 'desconhecido');
    assert.equal(option.assessment.accessibility, 'not_assessed');
    assert.ok(option.distanceMeters > 1000 && option.distanceMeters < 5000);
    assert.ok(option.durationSeconds > 600 && option.durationSeconds < 3600);
    assert.ok(Math.abs(option.points[0]!.latitude - input.origin.latitude) < 0.001);
    assert.ok(Math.abs(option.points.at(-1)!.longitude - input.destination.longitude) < 0.001);
    assert.deepEqual(option.geometry.coordinates[0], [
      option.points[0]!.longitude,
      option.points[0]!.latitude,
    ]);
    assert.ok(option.instructions.length > 0);
    assert.ok(option.instructions.every((value) => value.endPointIndex < option.points.length));
    assert.ok(
      option.instructions.every(
        (value) => !/the crosswalk|Take the stairs|\bem a calçada\b/i.test(value.text),
      ),
    );
    assert.equal(option.provenance.computedAt, now.toISOString());
    assert.equal(option.provenance.expiresAt, '2026-10-28T15:15:00.000Z');
  }
  const localizedInstructions = options.flatMap((option) =>
    option.instructions.map((step) => step.text),
  );
  assert.ok(localizedInstructions.some((text) => text.includes('faixa de pedestres')));
  assert.ok(localizedInstructions.some((text) => text.includes('Use as escadas')));
  const steps = options[0]!.instructions;
  assert.equal(steps[0]!.maneuver, 'depart');
  assert.equal(steps.at(-1)!.maneuver, 'arrive');
  for (const step of steps) {
    if (step.text.startsWith('Vire à direita')) assert.equal(step.maneuver, 'right');
    if (step.text.startsWith('Vire à esquerda')) assert.equal(step.maneuver, 'left');
    if (step.text.startsWith('Use as escadas')) assert.equal(step.maneuver, 'stairs');
    if (step.text.startsWith('Continue')) assert.equal(step.maneuver, 'continue');
  }
  assert.equal(valhallaManeuver(undefined), 'other');
  assert.equal(valhallaManeuver(999), 'other');
  assert.equal(
    new Set(options.map((option) => JSON.stringify(option.geometry))).size,
    options.length,
  );
});
test('Valhalla não converte falhas, rotas de carro ou instruções fora da geometria em trajeto válido', async () => {
  assert.throws(() => parseValhalla({ error_code: 442, error: 'No path' }, input), AppError);
  const payload = (await readFixture('valhalla-paulista-frei-caneca')) as {
    trip: { legs: { maneuvers: { travel_mode: string; end_shape_index: number }[] }[] };
  };
  payload.trip.legs[0]!.maneuvers[0]!.travel_mode = 'drive';
  assert.throws(() => parseValhalla(payload, input), AppError);
  payload.trip.legs[0]!.maneuvers[0]!.travel_mode = 'pedestrian';
  payload.trip.legs[0]!.maneuvers[0]!.end_shape_index = 999999;
  assert.throws(() => parseValhalla(payload, input), AppError);
  assert.throws(() => decodePolyline6('_'));
  assert.throws(() => decodePolyline6(''));
  assert.throws(() => decodePolyline6('~~~~~~~~~~~~'));
});
test('buildValhallaRequest aplica a preferência de percurso escolhida', () => {
  const standard = buildValhallaRequest(input);
  assert.equal(standard.costing, 'pedestrian');
  assert.equal('costing_options' in standard, false);
  const lit = buildValhallaRequest({ ...input, preference: 'prefer_lit' });
  assert.deepEqual(lit.costing_options, { pedestrian: { use_lit: 1, alley_factor: 5 } });
  const stepFree = buildValhallaRequest({ ...input, preference: 'step_free' });
  assert.deepEqual(stepFree.costing_options, { pedestrian: { type: 'wheelchair' } });
  for (const request of [standard, lit, stepFree]) {
    assert.deepEqual(request.locations, [
      { lat: input.origin.latitude, lon: input.origin.longitude },
      { lat: input.destination.latitude, lon: input.destination.longitude },
    ]);
  }
});
test('o perfil salvo muda ritmo e caminho e se soma ao critério escolhido', async () => {
  const senior = buildValhallaRequest({ ...input, preference: 'step_free' }, 'pcd');
  assert.deepEqual(senior.costing_options, {
    pedestrian: { walking_speed: 3.6, use_hills: 0.1, type: 'wheelchair' },
  });
  // Quem escolhe "Padrão" no perfil idoso ou PCD continua com ritmo calmo, mas aceita escadas.
  const seniorStandard = buildValhallaRequest(input, 'pcd');
  assert.deepEqual(seniorStandard.costing_options, {
    pedestrian: { walking_speed: 3.6, use_hills: 0.1 },
  });
  const child = buildValhallaRequest(input, 'child') as {
    costing_options: { pedestrian: Record<string, number> };
  };
  assert.ok(child.costing_options.pedestrian.sidewalk_factor! < 1);
  assert.ok(child.costing_options.pedestrian.alley_factor! > 2);
  assert.equal('costing_options' in buildValhallaRequest(input, 'night'), false);
  // De carro, o perfil de caminhada não se aplica.
  const driving = buildValhallaRequest({ ...input, profile: 'auto' }, 'pcd') as {
    costing_options: Record<string, unknown>;
  };
  assert.equal('pedestrian' in driving.costing_options, false);

  const fixture = await readFixture('valhalla-paulista-frei-caneca');
  const route = parseValhalla(fixture, input, new Date(), 'pcd')[0]!;
  assert.equal(route.walkingProfile, 'pcd');
  assert.match(route.description, /ritmo calmo/);
  assert.equal(parseValhalla(fixture, input)[0]!.walkingProfile, 'standard');
});
test('Contexto inclui apenas registros próximos, cruzamentos e áreas; não classifica histórico como risco atual', async () => {
  const route = parseValhalla(await readFixture('valhalla-paulista-frei-caneca'), input)[0]!;
  const feature = (id: string, geometry: UrbanFeature['geometry']): UrbanFeature => ({
    type: 'Feature',
    id,
    geometry,
    properties: {
      title: id,
      type: 'flood_history',
      category: 'flood',
      sourceId: 'test-history',
      sourceFeatureId: id,
      observedAt: '2020-01-01T00:00:00.000Z',
      details: { historical: true },
    },
  });
  const context: UrbanLayersResponse = {
    type: 'FeatureCollection',
    bbox: [-46.8, -23.7, -46.5, -23.4],
    truncated: true,
    generatedAt: new Date().toISOString(),
    sources: [],
    coverageWarnings: [],
    weather: null,
    floodSummary: null,
    features: [
      feature('próximo', { type: 'Point', coordinates: route.geometry.coordinates[0]! }),
      feature('distante', { type: 'Point', coordinates: [-46.75, -23.65] }),
      feature('cruza', {
        type: 'LineString',
        coordinates: [
          [-46.8, -23.56],
          [-46.4, -23.56],
        ],
      }),
      feature('dentro-de-buraco', {
        type: 'Polygon',
        coordinates: [
          [
            [-46.7, -23.6],
            [-46.6, -23.6],
            [-46.6, -23.5],
            [-46.7, -23.5],
            [-46.7, -23.6],
          ],
          [
            [-46.68, -23.58],
            [-46.62, -23.58],
            [-46.62, -23.52],
            [-46.68, -23.52],
            [-46.68, -23.58],
          ],
        ],
      }),
    ],
  };
  const enriched = attachCachedContext(route, context);
  assert.deepEqual(
    enriched.context?.nearbyFeatures.map((value) => value.id),
    ['próximo', 'cruza'],
  );
  assert.equal(
    enriched.context?.nearbyFeatures[0]?.properties.observedAt,
    '2020-01-01T00:00:00.000Z',
  );
  assert.equal(enriched.assessment.safety, 'not_assessed');
  assert.equal(enriched.riskLabel, 'desconhecido');
  assert.deepEqual(enriched.geometry, route.geometry);
  assert.equal(enriched.context?.truncated, true);
  const mapContext = filterRouteContext(route, context);
  assert.deepEqual(
    mapContext.features.map((feature) => feature.id),
    ['próximo', 'cruza'],
  );
  assert.equal(mapContext.features[0]?.geometry, context.features[0]?.geometry);
});
test('atualização de percurso longo limita a três áreas e preserva os limites de consulta', async () => {
  const base = parseValhalla(await readFixture('valhalla-paulista-frei-caneca'), input)[0]!;
  const route = {
    ...base,
    points: [
      { longitude: -46.9, latitude: -23.65 },
      { longitude: -46.7, latitude: -23.6 },
      { longitude: -46.5, latitude: -23.55 },
    ],
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-46.9, -23.65],
        [-46.7, -23.6],
        [-46.5, -23.55],
      ] as [number, number][],
    },
  };
  const boxes = routeContextBoxes(route);
  assert.equal(boxes.length, 3);
  for (const [west, south, east, north] of boxes) {
    assert.ok(east > west && north > south);
    assert.ok(east - west < 0.08 && north - south < 0.08);
  }
});
test('chuva destaca apenas exposição conhecida a áreas de histórico/modelo sem afirmar alagamento ativo', async () => {
  const now = Date.now();
  const base = parseValhalla(
    await readFixture('valhalla-paulista-frei-caneca'),
    input,
    new Date(now),
  )[0]!;
  const makeSource = (
    id: string,
    type: UrbanLayersResponse['sources'][number]['type'],
    georeferencedCurrentEvents = false,
  ): UrbanLayersResponse['sources'][number] => ({
    id,
    name: id,
    type,
    sourceUrl: 'https://example.com/source',
    attribution: 'Fonte pública de teste.',
    license: 'Teste',
    status: 'available',
    confidence: 'not_assessed',
    fetchedAt: new Date(now).toISOString(),
    asOf: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60000).toISOString(),
    featureCount: 1,
    georeferencedCurrentEvents,
    coverage: 'Consulta georreferenciada de teste.',
    message: 'Teste.',
  });
  const feature = (
    id: string,
    type: UrbanFeature['properties']['type'],
    sourceId: string,
    details: UrbanFeature['properties']['details'] = {},
  ): UrbanFeature => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: base.geometry.coordinates[0]! },
    properties: {
      title: id,
      type,
      category: 'flood',
      sourceId,
      sourceFeatureId: id,
      observedAt: new Date(now).toISOString(),
      details,
    },
  });
  const data: UrbanLayersResponse = {
    type: 'FeatureCollection',
    features: [
      feature('historical', 'flood_history', 'history'),
      feature('modeled', 'flood_risk', 'risk'),
    ],
    sources: [
      makeSource('history', 'flood_history'),
      makeSource('risk', 'flood_risk'),
      makeSource('cge-floods', 'floods'),
    ],
    bbox: [-46.8, -23.7, -46.5, -23.4],
    truncated: false,
    generatedAt: new Date(now).toISOString(),
    coverageWarnings: [],
    weather: {
      latitude: -23.56,
      longitude: -46.65,
      observedAt: new Date(now).toISOString(),
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10 * 60000).toISOString(),
      precipitationMillimeters: 0.3,
      rainMillimeters: 0.3,
      intervalSeconds: 900,
      weatherCode: 61,
      sourceUrl: 'https://open-meteo.com/en/docs',
      attribution: 'Open-Meteo',
      note: 'Precipitação modelada.',
    },
    floodSummary: null,
  };
  const assessment = assessRouteFlood(withFloodAssessment(base, data, now), data, now);
  assert.equal(assessment.weatherCondition, 'raining');
  assert.equal(assessment.recommendation, 'caution');
  assert.equal(assessment.activeIncidentCount, 0);
  assert.equal(assessment.historicalAreaCount, 1);
  assert.equal(assessment.modeledAreaCount, 1);
  assert.match(assessment.summary, /não confirma água na via/);
});

test('total municipal do CGE não vira bloqueio de rua nem desvio por rota', async () => {
  const now = Date.now();
  const base = parseValhalla(
    await readFixture('valhalla-paulista-frei-caneca'),
    input,
    new Date(now),
  )[0]!;
  const source: UrbanLayersResponse['sources'][number] = {
    id: 'cge-floods',
    name: 'CGE · resumo municipal',
    type: 'floods',
    sourceUrl: 'https://www.cgesp.org/v3/alagamentos.jsp',
    attribution: 'CGE',
    license: 'Consulta pública',
    status: 'available',
    confidence: 'not_assessed',
    fetchedAt: new Date(now).toISOString(),
    asOf: new Date(now).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
    featureCount: 0,
    georeferencedCurrentEvents: false,
    coverage: 'Resumo municipal sem localização individual verificada.',
    message: 'Sem coordenadas.',
  };
  const data: UrbanLayersResponse = {
    type: 'FeatureCollection',
    features: [],
    sources: [source],
    bbox: [-46.8, -23.7, -46.5, -23.4],
    truncated: true,
    generatedAt: new Date(now).toISOString(),
    coverageWarnings: ['Cobertura parcial.'],
    weather: null,
    floodSummary: {
      date: new Date(now).toISOString().slice(0, 10),
      activePassableForVehicles: 0,
      activeImpassableForVehicles: 7,
      inactivePassableForVehicles: 0,
      inactiveImpassableForVehicles: 0,
      recordsWithoutCoordinates: 7,
      note: 'Resumo municipal, sem coordenadas.',
    },
  };
  const route = { ...base, profile: 'auto' as const };
  const assessed = withFloodAssessment(route, data, now);
  const assessment = assessed.context!.floodAssessment!;
  assert.equal(assessment.sourceStatus, 'aggregate_only');
  assert.equal(assessment.activeIncidentCount, 0);
  assert.equal(assessment.impassableIncidentCount, 0);
  assert.equal(assessment.recommendation, 'unknown');
  assert.equal(assessment.preferredAlternative, false);
  assert.match(assessment.summary, /sem coordenadas verificadas/);
});

test('evento georreferenciado atual só bloqueia o modo com intransitabilidade explicitada', async () => {
  const now = Date.now();
  const base = parseValhalla(
    await readFixture('valhalla-paulista-frei-caneca'),
    input,
    new Date(now),
  )[0]!;
  const currentSource: UrbanLayersResponse['sources'][number] = {
    id: 'cge-georeferenced',
    name: 'Ocorrências CGE georreferenciadas',
    type: 'floods',
    sourceUrl: 'https://example.com/live-floods',
    attribution: 'Fonte pública de teste.',
    license: 'Teste',
    status: 'available',
    confidence: 'not_assessed',
    fetchedAt: new Date(now).toISOString(),
    asOf: new Date(now).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
    featureCount: 1,
    georeferencedCurrentEvents: true,
    coverage: 'Consulta georreferenciada atual.',
    message: 'Teste.',
  };
  const modelSource: UrbanLayersResponse['sources'][number] = {
    ...currentSource,
    id: 'risk',
    name: 'Áreas modeladas',
    type: 'flood_risk',
    georeferencedCurrentEvents: false,
  };
  const incident: UrbanFeature = {
    type: 'Feature',
    id: 'current-flood',
    geometry: { type: 'Point', coordinates: base.geometry.coordinates[0]! },
    properties: {
      title: 'Alagamento ativo',
      type: 'floods',
      category: 'flood',
      sourceId: currentSource.id,
      sourceFeatureId: 'event-1',
      observedAt: new Date(now).toISOString(),
      details: {
        liveFlood: true,
        vehiclePassability: 'impassable',
        pedestrianPassability: 'unknown',
      },
    },
  };
  const data: UrbanLayersResponse = {
    type: 'FeatureCollection',
    features: [incident],
    sources: [currentSource, modelSource],
    bbox: [-46.8, -23.7, -46.5, -23.4],
    truncated: false,
    generatedAt: new Date(now).toISOString(),
    coverageWarnings: [],
    weather: null,
    floodSummary: null,
  };
  const car = withFloodAssessment({ ...base, profile: 'auto' }, data, now);
  const pedestrian = withFloodAssessment({ ...base, profile: 'pedestrian' }, data, now);
  assert.equal(car.context?.floodAssessment?.recommendation, 'avoid');
  assert.equal(car.context?.floodAssessment?.impassableIncidentCount, 1);
  assert.equal(pedestrian.context?.floodAssessment?.recommendation, 'caution');
  assert.equal(pedestrian.context?.floodAssessment?.activeIncidentCount, 1);
  assert.equal(pedestrian.context?.floodAssessment?.impassableIncidentCount, 0);
});

test('marca apenas uma alternativa com menos exposição histórica/modelada conhecida durante chuva atual', async () => {
  const now = Date.now();
  const base = parseValhalla(
    await readFixture('valhalla-paulista-frei-caneca'),
    input,
    new Date(now),
  )[0]!;
  const source: UrbanLayersResponse['sources'][number] = {
    id: 'risk',
    name: 'GeoSampa · área modelada',
    type: 'flood_risk',
    sourceUrl: 'https://example.com/risk',
    attribution: 'Fonte pública de teste.',
    license: 'Teste',
    status: 'available',
    confidence: 'not_assessed',
    fetchedAt: new Date(now).toISOString(),
    asOf: new Date(now).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
    featureCount: 1,
    georeferencedCurrentEvents: false,
    coverage: 'Modelo hidrológico de teste.',
    message: 'Não é ocorrência ativa.',
  };
  const liveSummary: UrbanLayersResponse['sources'][number] = {
    ...source,
    id: 'cge-floods',
    name: 'CGE · resumo municipal',
    type: 'floods',
    georeferencedCurrentEvents: false,
  };
  const data: UrbanLayersResponse = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'modeled-area',
        geometry: { type: 'Point', coordinates: base.geometry.coordinates[0]! },
        properties: {
          title: 'Mancha modelada',
          type: 'flood_risk',
          category: 'flood',
          sourceId: source.id,
          sourceFeatureId: 'area-1',
          observedAt: new Date(now).toISOString(),
          details: {},
        },
      },
    ],
    sources: [source, liveSummary],
    bbox: [-46.8, -23.7, -46.5, -23.4],
    truncated: true,
    generatedAt: new Date(now).toISOString(),
    coverageWarnings: ['Consulta parcial de teste.'],
    weather: {
      latitude: -23.56,
      longitude: -46.65,
      observedAt: new Date(now).toISOString(),
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(),
      precipitationMillimeters: 0.2,
      rainMillimeters: 0.2,
      intervalSeconds: 900,
      weatherCode: 61,
      sourceUrl: 'https://open-meteo.com/en/docs',
      attribution: 'Open-Meteo',
      note: 'Precipitação modelada.',
    },
    floodSummary: null,
  };
  const fewer = withFloodAssessment(
    { ...base, id: '00000000-0000-4000-8000-000000000001' },
    { ...data, features: [] },
    now,
  );
  const more = withFloodAssessment(
    { ...base, id: '00000000-0000-4000-8000-000000000002' },
    data,
    now,
  );
  const prioritized = markLowerKnownFloodExposure([more, fewer]);
  const preferred = prioritized.find(
    (route) => route.context?.floodAssessment?.preferredAlternative,
  );
  assert.equal(preferred?.id, fewer.id);
  assert.equal(preferred?.context?.floodAssessment?.recommendation, 'lower_known_exposure');
  assert.equal(preferred?.context?.floodAssessment?.coveragePartial, true);
  assert.match(
    preferred?.context?.floodAssessment?.summary ?? '',
    /não garante que a via esteja livre/,
  );
  assert.equal(prioritized.length, 2);
});
test('Transporte restringe origem, bloqueia redirects e rejeita resposta excessiva sem inventar dados', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await assert.rejects(
      geographicJson(new URL('https://untrusted.invalid/')),
      /origin is not allowed/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(await geographicJson(new URL('/api/?q=public-test', photonOrigin)), {
      ok: true,
    });
    globalThis.fetch = async () => new Response('x'.repeat(1_500_001), { status: 200 });
    await assert.rejects(geographicJson(new URL('/api/?q=public-test', photonOrigin)), {
      code: 'GEOGRAPHIC_PROVIDER_UNAVAILABLE',
    });
    await assert.rejects(geographicJson(new URL('/api/?q=public-test', photonOrigin)), {
      code: 'GEOGRAPHIC_PROVIDER_COOLDOWN',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
