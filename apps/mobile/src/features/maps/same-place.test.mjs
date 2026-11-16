import assert from 'node:assert/strict';
import test from 'node:test';
import { isSamePlace } from './same-place';

const here = { latitude: -23.5614, longitude: -46.6559 };

test('o mesmo ponto, ou a poucos metros (erro do GPS), é o mesmo lugar', () => {
  assert.equal(isSamePlace(here, here), true);
  // ~33 m ao norte.
  assert.equal(isSamePlace(here, { latitude: -23.5611, longitude: -46.6559 }), true);
});

test('a uma quadra já é outro lugar', () => {
  // ~110 m ao norte.
  assert.equal(isSamePlace(here, { latitude: -23.5604, longitude: -46.6559 }), false);
});

test('sem origem ou destino não há comparação', () => {
  assert.equal(isSamePlace(null, here), false);
  assert.equal(isSamePlace(here, undefined), false);
});
