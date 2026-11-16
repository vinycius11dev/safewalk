import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredSession } from './session-parse';

test('parseStoredSession devolve null para vazio, JSON inválido e formato incompatível', () => {
  assert.equal(parseStoredSession(null), null);
  assert.equal(parseStoredSession(''), null);
  assert.equal(parseStoredSession('{quebrado'), null);
  assert.equal(parseStoredSession('{"token":1}'), null);
  assert.equal(parseStoredSession('null'), null);
});
