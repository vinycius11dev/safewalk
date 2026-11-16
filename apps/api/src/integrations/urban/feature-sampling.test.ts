import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UrbanFeature } from '@safewalk/contracts';
import { sampleUrbanFeatures } from './feature-sampling.js';
test('uma base densa não remove as outras categorias na amostragem', () => {
  const feature = (id: string, type: UrbanFeature['properties']['type']): UrbanFeature => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-46.65, -23.55] },
    properties: {
      title: id,
      type,
      category: 'other',
      sourceId: 'test',
      sourceFeatureId: id,
      observedAt: null,
      details: {},
    },
  });
  const data = [
    ...Array.from({ length: 5000 }, (_, i) => feature(`sidewalk-${i}`, 'sidewalks')),
    feature('report', 'sp156'),
    feature('flood', 'flood_history'),
  ];
  const sampled = sampleUrbanFeatures(data, 100);
  assert.equal(sampled.length, 100);
  assert.ok(sampled.some((f) => f.id === 'report'));
  assert.ok(sampled.some((f) => f.id === 'flood'));
});
