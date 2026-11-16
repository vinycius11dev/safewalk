import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canContactAcknowledge,
  isShareValid,
  nextAlertState,
  shareLinkExpiry,
  shareLinkState,
} from './trip-state.js';
import { hashSecret, verifySecret } from './security.js';

const now = new Date('2026-10-28T20:00:00Z');
test('alerta passa aos contatos após o prazo, mas permanece estável antes dele', () => {
  assert.equal(
    nextAlertState('checkin_pending', new Date(now.getTime() + 1), null, false, now),
    'checkin_pending',
  );
  assert.equal(nextAlertState('checkin_pending', now, null, false, now), 'alerted');
});
test('reconhecimento do contato evita a escalada, sem encerrar o SOS', () => {
  assert.equal(nextAlertState('alerted', null, now, true, now), 'alerted');
  assert.equal(nextAlertState('alerted', null, now, false, now), 'escalated');
});
test('trajeto encerrado não reabre por causa de prazo vencido', () => {
  assert.equal(nextAlertState('arrived', now, now, false, now), 'arrived');
  assert.equal(nextAlertState('cancelled', now, now, false, now), 'cancelled');
});
test('link expira no instante limite, após revogação e ao encerrar o trajeto', () => {
  const future = new Date(now.getTime() + 60000);
  assert.equal(isShareValid(future, null, 'active', now), true);
  assert.equal(isShareValid(now, null, 'active', now), false);
  assert.equal(isShareValid(future, now, 'active', now), false);
  assert.equal(isShareValid(future, null, 'arrived', now), false);
});
test('PIN é verificado por hash com salt; o valor errado não autentica', async () => {
  const hash = await hashSecret('1234');
  assert.notEqual(hash, await hashSecret('1234'));
  assert.equal(await verifySecret('1234', hash), true);
  assert.equal(await verifySecret('4321', hash), false);
  assert.equal(await verifySecret('1234', 'malformed'), false);
});

test('recibo de chegada não reabre localização e não atravessa expiração ou revogação explícita', () => {
  const future = new Date(now.getTime() + 60000);
  assert.equal(shareLinkState(future, now, 'trip_finished', 'arrived', now), 'arrived');
  assert.equal(isShareValid(future, now, 'arrived', now), false);
  assert.equal(shareLinkState(now, now, 'trip_finished', 'arrived', now), 'expired');
  assert.equal(shareLinkState(future, now, null, 'arrived', now), 'expired');
  assert.equal(shareLinkState(future, now, 'trip_finished', 'cancelled', now), 'expired');
  assert.equal(shareLinkState(future, null, null, 'active', now), 'active');
});
test('link de trajeto encerrado sob coação continua acessível, mas respeita revogação e prazo', () => {
  const future = new Date(now.getTime() + 60000);
  const duressAt = new Date(now.getTime() - 60000);
  assert.equal(shareLinkState(future, null, null, 'arrived', now, duressAt), 'active');
  assert.equal(shareLinkState(future, null, null, 'cancelled', now, duressAt), 'active');
  assert.equal(isShareValid(future, null, 'arrived', now, duressAt), true);
  assert.equal(shareLinkState(future, now, null, 'arrived', now, duressAt), 'expired');
  assert.equal(shareLinkState(now, null, null, 'arrived', now, duressAt), 'expired');
  assert.equal(shareLinkState(future, null, null, 'arrived', now, null), 'expired');
});

test('contato só confirma alerta já enviado ou coação, nunca check-in pendente', () => {
  assert.equal(canContactAcknowledge('active', null), false);
  assert.equal(canContactAcknowledge('checkin_pending', null), false);
  assert.equal(canContactAcknowledge('alerted', null), true);
  assert.equal(canContactAcknowledge('escalated', null), true);
  assert.equal(canContactAcknowledge('arrived', null), false);
  assert.equal(canContactAcknowledge('arrived', now), true);
});

test('link de acompanhamento cobre o alerta tardio de um timer longo', () => {
  const issuedAt = new Date('2026-10-28T20:00:00Z');
  const shortTrip = new Date(issuedAt.getTime() + 17 * 60_000);
  const longTimer = new Date(issuedAt.getTime() + 120 * 60_000);
  assert.equal(shareLinkExpiry(issuedAt, shortTrip).getTime(), issuedAt.getTime() + 120 * 60_000);
  const expiry = shareLinkExpiry(issuedAt, longTimer);
  assert.ok(expiry.getTime() >= longTimer.getTime() + 60 * 60_000);
});
