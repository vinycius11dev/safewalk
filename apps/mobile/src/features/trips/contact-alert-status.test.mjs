import assert from 'node:assert/strict';
import test from 'node:test';
import { contactAlertStatus } from './contact-alert-status';

const message = (status, extra = {}) => ({
  contactId: '384b8375-36f1-4678-af7a-0eb55f0c385c',
  channel: 'email',
  status,
  attempts: 0,
  acceptedAt: null,
  ...extra,
});

test('aceito pelo servidor mostra o horário de São Paulo sem prometer leitura', () => {
  const status = contactAlertStatus(
    message('accepted_by_relay', { attempts: 1, acceptedAt: '2026-11-08T17:02:00.000Z' }),
  );
  assert.match(status.text, /às 14:02/);
  assert.match(status.text, /não confirma a leitura/);
});

test('falha, ausência de configuração e nova tentativa nunca parecem envio', () => {
  for (const status of ['failed', 'not_configured', 'not_enabled', 'cancelled'])
    assert.doesNotMatch(contactAlertStatus(message(status)).text, /aceito/);
  assert.match(contactAlertStatus(message('failed')).text, /WhatsApp ou SMS/);
  assert.match(contactAlertStatus(message('pending', { attempts: 1 })).text, /tentando de novo/);
  assert.match(contactAlertStatus(undefined).text, /Sem e-mail automático/);
});
