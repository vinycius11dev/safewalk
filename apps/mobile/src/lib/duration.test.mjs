import assert from 'node:assert/strict';
import test from 'node:test';
import { durationLabel, durationSpoken } from './duration';

test('abaixo de uma hora continua em minutos', () => {
  assert.equal(durationLabel(45), '45 min');
  assert.equal(durationSpoken(1), '1 minuto');
});

test('a partir de uma hora mostra horas e minutos', () => {
  assert.equal(durationLabel(60), '1 h');
  assert.equal(durationLabel(268), '4 h 28 min');
  assert.equal(durationSpoken(61), '1 hora e 1 minuto');
  assert.equal(durationSpoken(120), '2 horas');
  assert.equal(durationSpoken(268), '4 horas e 28 minutos');
});
