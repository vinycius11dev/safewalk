import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTACT_ALERT_MAX_ATTEMPTS,
  contactAlertAfterFailure,
  contactAlertDecision,
} from './contact-alert-delivery.js';

const authorized = { accepted: true, emailTripAlerts: true, email: 'contato@example.com' };
const link = new Date('2026-11-08T15:00:00Z');

test('tenta de novo com pausa crescente e desiste depois do limite', () => {
  assert.deepEqual(contactAlertAfterFailure(1), { status: 'pending', retryInMs: 30_000 });
  assert.deepEqual(contactAlertAfterFailure(2), { status: 'pending', retryInMs: 60_000 });
  assert.deepEqual(contactAlertAfterFailure(CONTACT_ALERT_MAX_ATTEMPTS), { status: 'failed' });
});

test('só envia para quem aceitou o convite e autorizou e-mail', () => {
  assert.equal(contactAlertDecision(authorized, true, link), 'send');
  assert.equal(contactAlertDecision({ ...authorized, accepted: false }, true, link), 'not_enabled');
  assert.equal(
    contactAlertDecision({ ...authorized, emailTripAlerts: false }, true, link),
    'not_enabled',
  );
  assert.equal(contactAlertDecision({ ...authorized, email: null }, true, link), 'not_enabled');
  assert.equal(contactAlertDecision(null, true, link), 'not_enabled');
});

test('sem SMTP não envia nada e diz que não está configurado', () => {
  assert.equal(contactAlertDecision(authorized, false, link), 'not_configured');
});

test('não emite link novo para quem teve o acesso revogado', () => {
  assert.equal(contactAlertDecision(authorized, true, null), 'not_enabled');
});
