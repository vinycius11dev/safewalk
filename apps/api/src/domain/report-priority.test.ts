import assert from 'node:assert/strict';
import test from 'node:test';
import { reportPriority } from './report-priority.js';

const base = { nearbyCount: 1, confirmationCount: 0, ageHours: 2 };

test('relato isolado e recente de calçada fica com prioridade normal', () => {
  assert.equal(reportPriority({ ...base, type: 'sidewalk' }), 'normal');
});

test('semáforo e alagamento já nascem com prioridade média pelo risco a quem anda a pé', () => {
  assert.equal(reportPriority({ ...base, type: 'traffic_light' }), 'medium');
  assert.equal(reportPriority({ ...base, type: 'flood' }), 'medium');
});

test('relatos repetidos no mesmo ponto e confirmações elevam a prioridade', () => {
  assert.equal(reportPriority({ ...base, type: 'pothole', nearbyCount: 3 }), 'high');
  assert.equal(reportPriority({ ...base, type: 'pothole', confirmationCount: 3 }), 'high');
  assert.equal(reportPriority({ ...base, type: 'pothole', nearbyCount: 2 }), 'medium');
});

test('cada fator tem teto e relato parado há uma semana sobe um ponto', () => {
  assert.equal(
    reportPriority({ type: 'sidewalk', nearbyCount: 50, confirmationCount: 50, ageHours: 1 }),
    'high',
  );
  assert.equal(reportPriority({ ...base, type: 'sidewalk', ageHours: 24 * 7 }), 'normal');
  assert.equal(
    reportPriority({ ...base, type: 'lighting', nearbyCount: 1, ageHours: 24 * 7 }),
    'medium',
  );
});
