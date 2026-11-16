import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PIN_FREE_ATTEMPTS,
  PIN_MAX_LOCK_SECONDS,
  pinLockMessage,
  pinLockSeconds,
} from './pin-lockout.js';

test('as primeiras tentativas erradas não bloqueiam', () => {
  for (let attempts = 0; attempts < PIN_FREE_ATTEMPTS; attempts++)
    assert.equal(pinLockSeconds(attempts), 0);
});

test('o bloqueio começa na última tentativa livre, dobra e respeita o teto', () => {
  assert.equal(pinLockSeconds(PIN_FREE_ATTEMPTS), 30);
  assert.equal(pinLockSeconds(PIN_FREE_ATTEMPTS + 1), 60);
  assert.equal(pinLockSeconds(PIN_FREE_ATTEMPTS + 2), 120);
  assert.equal(pinLockSeconds(PIN_FREE_ATTEMPTS + 50), PIN_MAX_LOCK_SECONDS);
});

test('a mensagem informa a espera sem expor o PIN', () => {
  assert.match(pinLockMessage(12.2), /13 segundos/);
  assert.match(pinLockMessage(61), /2 minutos/);
});
