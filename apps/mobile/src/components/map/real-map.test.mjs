import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { darkColors, lightColors } from '../../theme/tokens';
import { createBaseMapStyle, createOverlayLayers } from './real-map.map-style';
import { createMapData, interactiveFeatureId, OVERLAY_SOURCE } from './real-map.model';

test('both themes and camera modes satisfy the shared MapLibre style specification', () => {
  for (const colors of [darkColors, lightColors]) {
    for (const threeDimensional of [false, true]) {
      const style = createBaseMapStyle(colors, threeDimensional);
      style.sources[OVERLAY_SOURCE] = {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      };
      style.layers.push(...createOverlayLayers(colors));
      assert.deepEqual(validateStyleMin(style), []);
    }
  }
});

test('urban polygon geometry and source metadata survive overlay conversion', () => {
  const urbanFeatures = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'sidewalk-1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-46.65, -23.56],
              [-46.64, -23.56],
              [-46.64, -23.55],
              [-46.65, -23.56],
            ],
          ],
        },
        properties: { category: 'sidewalk', sourceId: 'geosampa', observedAt: null },
      },
    ],
  };
  const result = createMapData({ urbanFeatures });
  assert.deepEqual(result.features[0]?.geometry, urbanFeatures.features[0]?.geometry);
  assert.equal(result.features[0]?.properties?.sourceId, 'geosampa');
  assert.equal(result.features[0]?.properties?.observedAt, null);
  assert.equal(result.features[0]?.properties?.safewalkId, 'sidewalk-1');
  assert.equal(urbanFeatures.features[0]?.properties?.role, undefined);
});

test('clicks retain the original record identifier even if the map supplies a numeric id', () => {
  const data = createMapData({
    urbanFeatures: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'sp156:abc123',
          geometry: { type: 'Point', coordinates: [-46.65, -23.56] },
          properties: { category: 'sidewalk' },
        },
      ],
    },
    markers: [
      { id: 'marker-original', location: { latitude: -23.56, longitude: -46.65 }, title: 'Marker' },
    ],
  });
  assert.equal(
    interactiveFeatureId({ id: 0, properties: data.features[0].properties }),
    'sp156:abc123',
  );
  assert.equal(
    interactiveFeatureId({ id: 1, properties: data.features[1].properties }),
    'marker-original',
  );
  assert.equal(interactiveFeatureId({ id: 42 }), '42');
  assert.equal(interactiveFeatureId({}), null);
});
