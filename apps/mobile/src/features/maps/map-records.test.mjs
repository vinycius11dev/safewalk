import assert from 'node:assert/strict';
import test from 'node:test';
import { splitMapRecords } from './map-records';

const feature = (id, type, geometry, details = {}) => ({
  type: 'Feature',
  id,
  geometry,
  properties: {
    title: id,
    type,
    category: 'other',
    sourceId: 'test',
    sourceFeatureId: id,
    observedAt: null,
    details,
  },
});
const point = { type: 'Point', coordinates: [-46.65, -23.55] };

test('pontos viram ícones da categoria e geometrias continuam como desenho', () => {
  const sidewalk = feature('calcada', 'sidewalks', {
    type: 'LineString',
    coordinates: [
      [-46.65, -23.55],
      [-46.651, -23.551],
    ],
  });
  const { records, shapes } = splitMapRecords(
    [
      feature('semaforo', 'crossings', point),
      feature('aberta', 'sp156', point, { status: 'Em andamento' }),
      feature('multi', 'health', { type: 'MultiPoint', coordinates: [[-46.66, -23.56]] }),
      sidewalk,
    ],
    false,
  );
  assert.deepEqual(
    records.features.map((item) => [item.id, item.properties.category, item.properties.icon]),
    [
      ['semaforo', 'signals', 'signals'],
      ['aberta', 'reports', 'reports'],
      ['multi', 'health', 'health'],
    ],
  );
  assert.deepEqual(records.features[2].geometry.coordinates, [-46.66, -23.56]);
  assert.deepEqual(shapes.features, [sidewalk]);
});

test('alagamento só recebe destaque de chuva quando está chovendo', () => {
  const flood = feature('cge', 'floods', point);
  assert.equal(splitMapRecords([flood], false).records.features[0].properties.rainAttention, false);
  assert.equal(splitMapRecords([flood], true).records.features[0].properties.rainAttention, true);
});
