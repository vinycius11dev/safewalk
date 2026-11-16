import assert from 'node:assert/strict';
import test from 'node:test';
import { contactAlertEmail } from './alert-email.js';

const base = {
  to: 'contato@example.com',
  travelerName: 'Ana Souza',
  url: 'https://safewalk.example/acompanhar/token',
  linkExpiresAt: new Date('2026-11-08T17:30:00Z'),
};

test('o e-mail de SOS traz o primeiro nome, o link e o horário de São Paulo', () => {
  const email = contactAlertEmail({ ...base, reason: 'manual' });
  assert.match(email.text, /^Ana pediu ajuda pelo botão SOS/);
  assert.ok(!email.text.includes('Souza'));
  assert.ok(email.text.includes(base.url));
  assert.ok(email.text.includes('14:30'));
  assert.ok(email.text.includes('ligue 190'));
  assert.ok(!/[\r\n]/.test(email.subject));
});

test('sob coação pede para não mencionar o aviso à pessoa', () => {
  const email = contactAlertEmail({ ...base, reason: 'duress' });
  assert.match(email.text, /não mencione este aviso/);
});

test('check-in sem resposta e perda de sinal são explicados sem inventar o motivo', () => {
  assert.match(contactAlertEmail({ ...base, reason: 'late' }).text, /não respondeu ao check-in/);
  assert.match(
    contactAlertEmail({ ...base, reason: 'signal_lost' }).text,
    /parou de enviar a localização/,
  );
});
