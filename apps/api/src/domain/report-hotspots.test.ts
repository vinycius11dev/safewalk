import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHotspots, type HotspotSource } from './report-hotspots.js';

const at = (
  type: HotspotSource['type'],
  latitude: number,
  longitude: number,
  createdAt = '2026-11-10T12:00:00.000Z',
): HotspotSource => ({
  type,
  address: `Rua ${latitude}`,
  createdAt,
  location: { latitude, longitude },
});

test('relatos do mesmo tipo a ~100 m viram um ponto crítico, mesmo atravessando a grade de 3 casas', () => {
  // -23.5614 e -23.5619 caem em células diferentes ao arredondar para 3 casas.
  const spots = buildHotspots([
    at('pothole', -23.5614, -46.6559, '2026-11-01T12:00:00.000Z'),
    at('pothole', -23.5619, -46.6563),
    at('pothole', -23.5611, -46.6556),
  ]);
  assert.equal(spots.length, 1);
  assert.equal(spots[0]?.count, 3);
  assert.equal(spots[0]?.oldestAt, '2026-11-01T12:00:00.000Z');
  assert.equal(spots[0]?.address, 'Rua -23.5614');
});

test('tipos diferentes e relatos isolados não formam ponto crítico', () => {
  assert.deepEqual(
    buildHotspots([
      at('pothole', -23.56, -46.65),
      at('traffic_light', -23.56, -46.65),
      at('pothole', -23.58, -46.62),
    ]),
    [],
  );
  assert.deepEqual(buildHotspots([]), []);
});

test('ordena por quantidade e depois pelo mais antigo, e limita a oito', () => {
  const lights = [at('traffic_light', -23.55, -46.66), at('traffic_light', -23.5502, -46.6601)];
  const holes = [
    at('pothole', -23.57, -46.64, '2026-11-02T12:00:00.000Z'),
    at('pothole', -23.5701, -46.6401),
    at('pothole', -23.5702, -46.6402),
  ];
  const spots = buildHotspots([...lights, ...holes]);
  assert.deepEqual(
    spots.map((spot) => [spot.type, spot.count]),
    [
      ['pothole', 3],
      ['traffic_light', 2],
    ],
  );
  const many = Array.from({ length: 10 }, (_, index) => [
    at('flood', -23.4 - index * 0.01, -46.6),
    at('flood', -23.4 - index * 0.01, -46.6),
  ]).flat();
  assert.equal(buildHotspots(many).length, 8);
});
