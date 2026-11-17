import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAge, formatDay, formatDuration, formatSince } from './format.ts';

const now = Date.parse('2026-11-14T15:00:00Z');

test('idade do relato em linguagem de fila', () => {
  assert.equal(formatAge('2026-11-14T14:59:40Z', now), 'agora');
  assert.equal(formatAge('2026-11-14T14:15:00Z', now), 'há 45 min');
  assert.equal(formatAge('2026-11-14T09:00:00Z', now), 'há 6 h');
  assert.equal(formatAge('2026-11-13T09:00:00Z', now), 'há 1 dia');
  assert.equal(formatAge('2026-11-04T09:00:00Z', now), 'há 10 dias');
  assert.equal(formatAge('2026-11-14T16:00:00Z', now), 'agora');
});

test('duração e dia', () => {
  assert.equal(formatDuration(5.5), '5,5 h');
  assert.equal(formatDuration(72), '3 dias');
  assert.equal(formatDay('2026-11-13'), '13/11');
});

test('tempo desde a última atualização da fila', () => {
  assert.equal(formatSince(400), 'agora');
  assert.equal(formatSince(4_900), 'há 4 s');
  assert.equal(formatSince(125_000), 'há 2 min');
  assert.equal(formatSince(-50), 'agora');
});
