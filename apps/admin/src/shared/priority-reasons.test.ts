import assert from 'node:assert/strict';
import test from 'node:test';
import { priorityReasons } from './priority-reasons.ts';

const now = Date.parse('2026-11-14T12:00:00Z');

test('lista só os motivos que valem', () => {
  assert.deepEqual(
    priorityReasons(
      { type: 'pothole', nearbyCount: 1, confirmationCount: 0, createdAt: '2026-11-14T10:00:00Z' },
      now,
    ),
    [],
  );
  assert.deepEqual(
    priorityReasons(
      {
        type: 'traffic_light',
        nearbyCount: 3,
        confirmationCount: 1,
        createdAt: '2026-11-01T10:00:00Z',
      },
      now,
    ),
    [
      'Tipo de maior risco a quem anda a pé',
      '3 relatos em aberto do mesmo tipo a até 100 m',
      '1 pessoa confirmou que continua lá',
      'Aberto há mais de 7 dias',
    ],
  );
});
