import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordsCompareLabel,
  recordsLevelTone,
  recordsReason,
  recordsStepLabel,
} from './route-records-presentation';

const reading = (overrides = {}) => ({
  method: 'known_records_rules_v1',
  level: 'some',
  points: 8,
  pointsPerKm: 8,
  period: 'night',
  factors: [{ kind: 'crime', count: 3, points: 8, summary: '3 roubos. Boletins da SSP-SP.' }],
  highlights: [],
  fewestRecords: false,
  missingData: [],
  sources: [],
  notice: 'aviso',
  evaluatedAt: '2026-11-08T22:00:00.000Z',
  ...overrides,
});
const highlight = (level, reason, instructionIndex = null) => ({
  startMeters: 200,
  endMeters: 400,
  level,
  reason,
  instructionIndex,
});

test('poucos registros nunca aparecem com tom de aprovação', () => {
  assert.equal(recordsLevelTone(reading({ level: 'few' })), 'neutral');
  assert.equal(recordsLevelTone(reading({ level: 'insufficient' })), 'neutral');
  assert.equal(recordsLevelTone(reading({ level: 'many' })), 'warning');
});

test('explica primeiro o trecho com mais registros', () => {
  const value = reading({
    highlights: [highlight('some', 'trecho médio'), highlight('many', 'trecho pior')],
  });
  assert.equal(recordsReason(value), 'trecho pior');
});

test('sem trecho destacado usa o fator mais pesado e, sem dados, explica o que falta', () => {
  assert.match(recordsReason(reading()), /3 roubos/);
  assert.equal(
    recordsReason(reading({ level: 'insufficient', missingData: ['Dados da SSP ausentes.'] })),
    'Dados da SSP ausentes.',
  );
});

test('compara opções sem afirmar que uma é segura', () => {
  assert.equal(
    recordsCompareLabel({ recordsReading: reading({ fewestRecords: true }) }),
    'Menos registros conhecidos',
  );
  assert.equal(recordsCompareLabel({}), 'Sem leitura de registros');
});

test('localiza o trecho pela etapa do percurso quando ela existe', () => {
  const route = { instructions: [{ text: 'Siga pela Rua Augusta.' }] };
  assert.equal(
    recordsStepLabel(route, highlight('many', 'x', 0)),
    'Entre 200 m e 400 m do início: Siga pela Rua Augusta',
  );
  assert.equal(recordsStepLabel(route, highlight('many', 'x')), 'Entre 200 m e 400 m do início');
});
