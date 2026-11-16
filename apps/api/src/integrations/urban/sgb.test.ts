import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchSgbSusceptibility, normalizeSgbFeature } from './sgb.js';
import { selectUrbanDefinitions } from './urban-catalog.js';

test('consulta padrão não seleciona SGB; seleção explícita habilita somente a camada solicitada', () => {
  assert.ok(
    !selectUrbanDefinitions().some((definition) => definition.id === 'sgb-flood-susceptibility'),
  );
  assert.deepEqual(
    selectUrbanDefinitions(['flood_susceptibility']).map((definition) => definition.id),
    ['sgb-flood-susceptibility'],
  );
});

const polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-46.78, -23.63],
      [-46.77, -23.63],
      [-46.77, -23.62],
      [-46.78, -23.63],
    ],
  ],
};
const record = (id: number) => ({
  type: 'Feature',
  geometry: polygon,
  properties: {
    objectid: id,
    municipio: 'TABOÃO DA SERRA',
    classe: 'Média',
    ano: 2019,
    execucao: 'IPT (2013)',
    executor: 'IPT',
  },
});

test('SGB preserva município, classe e ano do estudo, sem alegar alagamento ativo', () => {
  const feature = normalizeSgbFeature(polygon, record(123).properties);
  assert.equal(feature.id, 'sgb-flood-susceptibility:123');
  assert.equal(feature.properties.type, 'flood_susceptibility');
  assert.equal(feature.properties.details.municipality, 'TABOÃO DA SERRA');
  assert.equal(feature.properties.details.susceptibilityClass, 'Média');
  assert.equal(feature.properties.details.studyYear, 2019);
  assert.equal(feature.properties.details.liveFlood, false);
  assert.equal(feature.properties.observedAt, null);
  assert.throws(() =>
    normalizeSgbFeature({ type: 'Point', coordinates: [-46.78, -23.63] }, record(123).properties),
  );
  assert.throws(() =>
    normalizeSgbFeature(
      {
        type: 'Polygon',
        coordinates: [
          [
            [999, 20],
            [0, 0],
            [1, 1],
            [999, 20],
          ],
        ],
      },
      record(123).properties,
    ),
  );
});

test('SGB pagina por id estável mesmo quando a primeira página tem menos que o limite', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'geoportal.sgb.gov.br');
    assert.equal(url.searchParams.get('outSR'), '4326');
    assert.equal(url.searchParams.get('geometry'), '-46.8,-23.64,-46.75,-23.6');
    assert.equal(url.searchParams.get('returnZ'), 'false');
    requests++;
    if (requests === 1) {
      assert.equal(url.searchParams.get('where'), '1=1');
      return Response.json({
        type: 'FeatureCollection',
        features: [record(10)],
        exceededTransferLimit: true,
      });
    }
    assert.equal(url.searchParams.get('where'), 'objectid > 10');
    return Response.json({
      type: 'FeatureCollection',
      features: [record(20)],
      exceededTransferLimit: false,
    });
  });
  const response = await fetchSgbSusceptibility([-46.8, -23.64, -46.75, -23.6]);
  assert.equal(requests, 2);
  assert.deepEqual(
    response.features.map((item) => item.id),
    ['sgb-flood-susceptibility:10', 'sgb-flood-susceptibility:20'],
  );
  assert.equal(response.truncated, false);
});

test('SGB informa cobertura parcial quando atinge limite de páginas', async (t) => {
  let id = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      type: 'FeatureCollection',
      features: [record(++id)],
      exceededTransferLimit: true,
    }),
  );
  const response = await fetchSgbSusceptibility([-46.8, -23.64, -46.75, -23.6]);
  assert.equal(response.features.length, 3);
  assert.equal(response.truncated, true);
});
