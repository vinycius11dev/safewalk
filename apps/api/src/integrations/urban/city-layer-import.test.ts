import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWideBounds, normalizeRegionBounds, pilotBounds } from './urban-bounds.js';
import { osmPlaceFeature, osmSignalFeature } from './city-layer-import.js';

test('Delegacia e hospital do OpenStreetMap usam o centro do prédio e não afirmam atendimento', () => {
  const hospital = osmPlaceFeature('hospital', 'Osasco', {
    type: 'way',
    id: 77,
    center: { lat: -23.532, lon: -46.791 },
    tags: {
      amenity: 'hospital',
      name: 'Hospital Regional',
      'addr:street': 'Rua X',
      'addr:housenumber': '10',
    },
  });
  assert.ok(hospital);
  assert.equal(hospital.id, 'osm-hospitals:way/77');
  assert.equal(hospital.properties.type, 'health');
  assert.equal(hospital.properties.title, 'Hospital · Hospital Regional (OpenStreetMap)');
  assert.equal(hospital.properties.details.address, 'Rua X, 10');
  assert.equal(hospital.properties.details.emergencyService, 'not_verified');
  const police = osmPlaceFeature('police', 'Taboão da Serra', {
    type: 'node',
    id: 5,
    lat: -23.61,
    lon: -46.76,
    tags: { amenity: 'police' },
  });
  assert.ok(police);
  assert.equal(police.properties.type, 'police');
  assert.equal(police.properties.title, 'Polícia · Taboão da Serra (OpenStreetMap)');
  assert.equal(police.properties.details.attendance, 'not_verified');
  assert.equal(osmPlaceFeature('police', 'X', { type: 'way', id: 1, tags: {} }), null);
});

test('Visão da cidade aceita até 1,2° na região e encaixa na grade de 0,05°', () => {
  const city = normalizeRegionBounds([-46.83, -23.79, -46.41, -23.41]);
  assert.deepEqual(city, [-46.85, -23.8, -46.4, -23.4]);
  assert.equal(isWideBounds(city), true);
  // Bairro continua com a normalização fina dos provedores ao vivo.
  assert.deepEqual(normalizeRegionBounds([-46.661, -23.571, -46.639, -23.549]), pilotBounds);
  assert.equal(isWideBounds(pilotBounds), false);
  assert.throws(() => normalizeRegionBounds([-47.2, -24.1, -45.95, -23.15]));
  assert.throws(() => normalizeRegionBounds([-43.3, -22.95, -43.1, -22.85]));
});

test('Semáforo do OpenStreetMap vira registro colaborativo, sem afirmar funcionamento', () => {
  const feature = osmSignalFeature('Taboão da Serra', {
    type: 'node',
    id: 123,
    lat: -23.6086,
    lon: -46.7586,
    tags: { highway: 'traffic_signals', crossing: 'traffic_signals' },
  });
  assert.ok(feature);
  assert.equal(feature.id, 'osm-signals:node/123');
  assert.equal(feature.properties.type, 'crossings');
  assert.equal(feature.properties.details.municipality, 'Taboão da Serra');
  assert.equal(feature.properties.details.operatingStatus, 'unknown');
  assert.equal(feature.properties.details.collaborativeSource, true);
  assert.deepEqual(feature.geometry, { type: 'Point', coordinates: [-46.7586, -23.6086] });
});

test('Semáforo fora da região importada é descartado', () => {
  assert.equal(
    osmSignalFeature('Rio', { type: 'node', id: 1, lat: -22.9, lon: -43.2, tags: {} }),
    null,
  );
});
