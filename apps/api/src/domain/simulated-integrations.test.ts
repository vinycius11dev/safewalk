import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unansweredAlertEvent, usesSimulatedIntegrations } from './simulated-integrations.js';

test('real accounts on route or timer trips never use simulated integrations', () => {
  assert.equal(usesSimulatedIntegrations({ mode: 'route', ownerIsDemo: false }), false);
  assert.equal(usesSimulatedIntegrations({ mode: 'timer', ownerIsDemo: false }), false);
});

test('the demonstration keeps them: demo-mode trips and every trip of the demo account', () => {
  assert.equal(usesSimulatedIntegrations({ mode: 'demo', ownerIsDemo: false }), true);
  assert.equal(usesSimulatedIntegrations({ mode: 'route', ownerIsDemo: true }), true);
  assert.equal(usesSimulatedIntegrations({ mode: 'timer', ownerIsDemo: true }), true);
});

test('an unanswered alert names the GCM only in the demonstration', () => {
  assert.equal(unansweredAlertEvent(true), 'gcm_escalation_simulated');
  assert.equal(unansweredAlertEvent(false), 'alert_unanswered_by_contacts');
});
