import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminReportItem } from '@safewalk/contracts';
import { findArrivals, snapshotOf } from './arrivals.ts';

const now = Date.parse('2026-11-14T15:00:00Z');
const report = (id: string, createdAt: string): AdminReportItem => ({
  id,
  type: 'lighting',
  description: '',
  address: 'Rua de teste, 10',
  location: { latitude: -23.55, longitude: -46.63 },
  createdAt,
  status: 'received',
  statusUpdatedAt: createdAt,
  hasPhoto: false,
  confirmationCount: 0,
  nearbyCount: 1,
  priority: 'normal',
  authorResolved: false,
});

const old = report('a', '2026-11-13T10:00:00Z');
const older = report('b', '2026-11-10T10:00:00Z');
const fresh = report('c', '2026-11-14T14:59:55Z');

test('primeira carga e troca de filtro não anunciam relato novo', () => {
  assert.deepEqual(findArrivals(null, 'open', [old, fresh], now), []);
  const seen = snapshotOf('open', [old], null);
  assert.deepEqual(findArrivals(seen, 'all', [old, fresh], now), []);
});

test('anuncia só o relato criado depois da busca anterior', () => {
  const seen = snapshotOf('open', [old], null);
  assert.deepEqual(
    findArrivals(seen, 'open', [fresh, old], now).map((item) => item.id),
    ['c'],
  );
});

test('caso antigo que volta à fila não é relato novo', () => {
  const seen = snapshotOf('open', [old], null);
  assert.deepEqual(findArrivals(seen, 'open', [old, older], now), []);
});

test('o mais recente já visto não regride quando um relato sai da fila', () => {
  const first = snapshotOf('open', [old, fresh], null);
  const second = snapshotOf('open', [old], first);
  assert.equal(second.newestAt, Date.parse(fresh.createdAt));
  assert.equal(snapshotOf('all', [old], first).newestAt, Date.parse(old.createdAt));
});
