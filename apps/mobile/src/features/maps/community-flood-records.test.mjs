import assert from 'node:assert/strict';
import test from 'node:test';
import { communityFloodRecords, reportedAgo } from './community-flood-records';

const report = (id, type) => ({
  id,
  type,
  description: '',
  location: { latitude: -23.56, longitude: -46.65 },
  distanceMeters: 100,
  createdAt: '2026-11-07T10:00:00.000Z',
  expiresAt: '2026-11-07T22:00:00.000Z',
  hasPhoto: false,
  confirmationCount: 0,
  resolvedCount: 0,
  notFoundCount: 0,
  myChoice: null,
});

test('só relatos de alagamento viram bolhas de alagamento no mapa', () => {
  const records = communityFloodRecords([report('a', 'flood'), report('b', 'robbery')], true);
  assert.equal(records.features.length, 1);
  assert.equal(records.features[0].id, 'community:a');
  assert.deepEqual(records.features[0].geometry.coordinates, [-46.65, -23.56]);
  assert.equal(records.features[0].properties.category, 'floods');
  assert.equal(records.features[0].properties.rainAttention, true);
  assert.equal(communityFloodRecords(undefined, false).features.length, 0);
});

test('tempo do relato em linguagem simples', () => {
  const at = Date.parse('2026-11-07T10:00:00.000Z');
  assert.equal(reportedAgo('2026-11-07T10:00:00.000Z', at + 20 * 60000), 'há 20 min');
  assert.equal(reportedAgo('2026-11-07T10:00:00.000Z', at + 3 * 3600000), 'há 3 h');
  assert.equal(reportedAgo('2026-11-07T10:00:00.000Z', at + 26 * 3600000), 'há 1 dia');
});
