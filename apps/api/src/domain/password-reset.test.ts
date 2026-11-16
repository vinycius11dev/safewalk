import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordResetTokenSchema } from '@safewalk/contracts';
import {
  hashResetToken,
  newResetToken,
  resetLink,
  sessionStartedBeforeReset,
} from './password-reset.js';

test('reset tokens are random, match the shared schema and are stored only as a hash', () => {
  const first = newResetToken();
  const second = newResetToken();
  assert.notEqual(first.token, second.token);
  assert.equal(passwordResetTokenSchema.safeParse(first.token).success, true);
  assert.equal(first.hash, hashResetToken(first.token));
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.equal(first.hash.includes(first.token), false);
});

test('reset links point to the reset page of the given site', () => {
  assert.equal(
    resetLink('https://safewalk.example', 'abc_-123'),
    'https://safewalk.example/redefinir-senha?token=abc_-123',
  );
  assert.equal(
    resetLink('https://painel.safewalk.example/', 'x'),
    'https://painel.safewalk.example/redefinir-senha?token=x',
  );
});

test('sessions opened before a password reset stop being valid', () => {
  const resetAt = new Date('2026-11-15T12:00:00.000Z');
  const seconds = resetAt.getTime() / 1000;
  assert.equal(sessionStartedBeforeReset(seconds - 1, resetAt), true);
  assert.equal(sessionStartedBeforeReset(seconds, resetAt), false);
  assert.equal(sessionStartedBeforeReset(seconds + 60, resetAt), false);
  assert.equal(sessionStartedBeforeReset(seconds - 3600, null), false);
  assert.equal(sessionStartedBeforeReset(undefined, resetAt), true);
});
