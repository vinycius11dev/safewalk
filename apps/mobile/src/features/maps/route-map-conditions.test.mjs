import assert from 'node:assert/strict';
import test from 'node:test';
import { routeRain, routeUrbanMap } from './route-map-conditions';
import { recordReference, routeRecordMarkers, recordId } from './route-record-markers';
const now = Date.parse('2026-11-03T12:00:00Z');
const feature = {
  type: 'Feature',
  id: 'flood-area',
  properties: {
    type: 'flood_susceptibility',
    category: 'flood',
    title: 'Área de estudo',
    sourceId: 'sgb',
    sourceFeatureId: '1',
    observedAt: null,
    details: {},
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ],
    ],
  },
};
const data = {
  features: [feature],
  weather: {
    observedAt: '2026-11-03T12:00:00Z',
    expiresAt: '2026-11-03T12:10:00Z',
    precipitationMillimeters: 0.1,
    rainMillimeters: 0.1,
    weatherCode: 51,
  },
};
test('chuva recente destaca suscetibilidade, sem trocar o tipo por alagamento ativo', () => {
  assert.equal(routeRain(data, now), 'raining');
  const map = routeUrbanMap(data, false, now);
  assert.equal(map.features[0].properties.rainAttention, true);
  assert.equal(map.features[0].properties.type, 'flood_susceptibility');
  assert.equal(map.features[0].geometry, feature.geometry);
});
test('chuva vencida ou ausente não ativa destaque meteorológico', () => {
  assert.equal(routeRain(data, now + 3600000), 'stale');
  assert.equal(
    routeUrbanMap(data, false, now + 3600000).features[0].properties.rainAttention,
    false,
  );
  assert.equal(routeRain(undefined, now), 'unknown');
});
test('perfil de acessibilidade destaca infraestrutura e mantém os outros registros', () => {
  const sidewalk = {
    ...feature,
    id: 'sidewalk',
    properties: { ...feature.properties, type: 'sidewalks', category: 'sidewalk' },
  };
  const mapped = routeUrbanMap({ ...data, features: [sidewalk, feature] }, true, now);
  assert.equal(mapped.features.length, 2);
  assert.equal(mapped.features[0].properties.routeEmphasis, true);
  assert.equal(mapped.features[1].properties.routeEmphasis, false);
});
test('ponto de referência de polígono fica dentro da área e não ocupa um buraco', () => {
  const path = [
    { longitude: 1, latitude: 1 },
    { longitude: 0.2, latitude: 0.2 },
  ];
  const withHole = {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [
        ...feature.geometry.coordinates,
        [
          [0.5, 0.5],
          [1.5, 0.5],
          [1.5, 1.5],
          [0.5, 1.5],
          [0.5, 0.5],
        ],
      ],
    },
  };
  assert.deepEqual(recordReference(withHole, path), path[1]);
  assert.equal(recordReference(feature, [{ longitude: 5, latitude: 5 }]), null);
  const markers = routeRecordMarkers(data, { points: path }, false, now);
  assert.equal(markers[0].rainAttention, true);
  assert.equal(recordId(markers[0].id), 'flood-area');
  assert.equal(markers[0].label, undefined);
});
