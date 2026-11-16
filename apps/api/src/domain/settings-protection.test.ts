import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsChangeNeedsPin } from './settings-protection.js';

const base = {
  responseSeconds: 30,
  automaticDetection: true,
  arrivalCheckin: true,
  retentionDays: 30,
  signalLossMinutes: 10,
} as const;

test('mudanças que só aumentam proteção não pedem PIN', () => {
  assert.equal(settingsChangeNeedsPin(base, base), false);
  assert.equal(settingsChangeNeedsPin(base, { ...base, responseSeconds: 15 }), false);
  assert.equal(settingsChangeNeedsPin(base, { ...base, retentionDays: 90 }), false);
  assert.equal(settingsChangeNeedsPin(base, { ...base, signalLossMinutes: 5 }), false);
  const off = { ...base, automaticDetection: false, arrivalCheckin: false, signalLossMinutes: 0 };
  assert.equal(settingsChangeNeedsPin(off, base), false);
});

test('reduzir proteção pede PIN', () => {
  assert.equal(settingsChangeNeedsPin(base, { ...base, automaticDetection: false }), true);
  assert.equal(settingsChangeNeedsPin(base, { ...base, arrivalCheckin: false }), true);
  assert.equal(settingsChangeNeedsPin(base, { ...base, responseSeconds: 60 }), true);
  assert.equal(settingsChangeNeedsPin(base, { ...base, retentionDays: 7 }), true);
  assert.equal(settingsChangeNeedsPin(base, { ...base, signalLossMinutes: 0 }), true);
  assert.equal(settingsChangeNeedsPin(base, { ...base, signalLossMinutes: 15 }), true);
});
