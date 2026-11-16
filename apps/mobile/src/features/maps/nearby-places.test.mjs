import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatStraightDistance,
  nearestPlaces,
  placeName,
  straightDistanceMeters,
} from './nearby-places';

const place = (id, type, latitude, longitude, title = id) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties: { title, type, category: 'safe-place', sourceId: 's', sourceFeatureId: id },
});
const origin = { latitude: -23.56, longitude: -46.65 };

test('acha a delegacia e o hospital mais próximos, nessa ordem', () => {
  const result = nearestPlaces(
    [
      place('h-longe', 'health', -23.6, -46.65),
      place('dp-perto', 'police', -23.561, -46.65),
      place('h-perto', 'health', -23.565, -46.65),
      place('dp-longe', 'police', -23.58, -46.65),
      place('semaforo', 'crossings', -23.5601, -46.65),
    ],
    origin,
  );
  assert.deepEqual(
    result.map((item) => [item.kind, item.feature.id]),
    [
      ['police', 'dp-perto'],
      ['health', 'h-perto'],
    ],
  );
  assert.ok(Math.abs(result[0].distanceMeters - 111) < 2);
});

test('sem delegacia carregada, mostra só o hospital', () => {
  const result = nearestPlaces([place('h', 'health', -23.565, -46.65)], origin);
  assert.deepEqual(
    result.map((item) => item.kind),
    ['health'],
  );
});

test('distância em linha reta legível', () => {
  assert.equal(formatStraightDistance(343), '340 m');
  assert.equal(formatStraightDistance(1234), '1,2 km');
  assert.equal(formatStraightDistance(12400), '12 km');
  assert.ok(
    Math.abs(straightDistanceMeters(origin, { latitude: -23.57, longitude: -46.65 }) - 1112) < 3,
  );
});

test('nome sem o prefixo da camada', () => {
  assert.equal(
    placeName(place('a', 'police', 0, 0, 'Delegacia · 1° DP - Liberdade')),
    '1° DP - Liberdade',
  );
  assert.equal(placeName(place('b', 'health', 0, 0, 'Hospital Sírio')), 'Hospital Sírio');
});
