import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { env } from '../../config/env.js';
import type { TripStartEmailTarget } from './contacts.repository.js';
import { dispatchTripStartEmails, invitationEmail, trackingEmail } from './trip-start-emails.js';

const optedInId = '11111111-1111-4111-8111-111111111111';
const notAcceptedId = '22222222-2222-4222-8222-222222222222';
const optedOutId = '33333333-3333-4333-8333-333333333333';
const noEmailId = '44444444-4444-4444-8444-444444444444';
const notSelectedId = '55555555-5555-4555-8555-555555555555';
const urlBase = 'https://safe.example';

function targets(): TripStartEmailTarget[] {
  return [
    {
      id: optedInId,
      email: 'friend@example.com',
      accepted: true,
      emailTripAlerts: true,
    },
    {
      id: notAcceptedId,
      email: 'pending@example.com',
      accepted: false,
      emailTripAlerts: true,
    },
    {
      id: optedOutId,
      email: 'quiet@example.com',
      accepted: true,
      emailTripAlerts: false,
    },
    {
      id: noEmailId,
      email: null,
      accepted: true,
      emailTripAlerts: false,
    },
    {
      id: notSelectedId,
      email: 'not-selected@example.com',
      accepted: true,
      emailTripAlerts: true,
    },
  ];
}

function links() {
  return [optedInId, notAcceptedId, optedOutId, noEmailId, notSelectedId].map((contactId) => ({
    contactId,
    expiresAt: '2026-11-04T15:00:00.000Z',
    url: `${urlBase}/acompanhar/${contactId}`,
  }));
}

test('only selected, accepted contacts with recorded email consent reach the relay', async () => {
  const previousUrl = env.PUBLIC_WEB_URL;
  env.PUBLIC_WEB_URL = urlBase;
  const sentTo: string[] = [];
  try {
    const result = await dispatchTripStartEmails(
      [optedInId, notAcceptedId, optedOutId, noEmailId],
      links(),
      targets(),
      {
        configured: true,
        sendEmail: async (message) => {
          sentTo.push(message.to);
        },
      },
    );
    assert.deepEqual(result, [
      { contactId: optedInId, status: 'accepted_by_relay' },
      { contactId: notAcceptedId, status: 'not_enabled' },
      { contactId: optedOutId, status: 'not_enabled' },
      { contactId: noEmailId, status: 'not_enabled' },
    ]);
    assert.deepEqual(sentTo, ['friend@example.com']);
  } finally {
    env.PUBLIC_WEB_URL = previousUrl;
  }
});

test('missing SMTP configuration is distinct from contact opt-out', async () => {
  const previousUrl = env.PUBLIC_WEB_URL;
  env.PUBLIC_WEB_URL = urlBase;
  try {
    const result = await dispatchTripStartEmails([optedInId, optedOutId], links(), targets(), {
      configured: false,
      sendEmail: async () => {
        assert.fail('must not attempt delivery when SMTP is unavailable');
      },
    });
    assert.deepEqual(result, [
      { contactId: optedInId, status: 'not_configured' },
      { contactId: optedOutId, status: 'not_enabled' },
    ]);
  } finally {
    env.PUBLIC_WEB_URL = previousUrl;
  }
});

test('relay errors are isolated to that contact and never reject trip-start dispatch', async () => {
  const previousUrl = env.PUBLIC_WEB_URL;
  env.PUBLIC_WEB_URL = urlBase;
  try {
    const result = await dispatchTripStartEmails([optedInId, optedInId], links(), targets(), {
      configured: true,
      sendEmail: async () => {
        throw new Error('private SMTP detail');
      },
    });
    assert.deepEqual(result, [{ contactId: optedInId, status: 'failed' }]);
  } finally {
    env.PUBLIC_WEB_URL = previousUrl;
  }
});

test('e-mail de acompanhamento diz quem começou o trajeto e leva o link no texto e no botão', () => {
  const url = 'https://safewalk.example/acompanhar/abc';
  const email = trackingEmail('mae@exemplo.com', url, 'Marina Souza');
  assert.equal(email.subject, 'Marina começou um trajeto no SafeWalk');
  assert.ok(email.text.includes(url));
  assert.ok(email.html?.includes(`href="${url}"`));
  assert.ok(email.html?.includes('Acompanhar trajeto'));
  assert.equal(
    trackingEmail('mae@exemplo.com', url).subject,
    'Uma pessoa de confiança começou um trajeto no SafeWalk',
  );
  assert.ok(!trackingEmail('a@b.com', url, '<b>x</b>').html?.includes('<b>x</b>'));
});

test('e-mail de convite leva o link do convite', () => {
  const url = 'https://safewalk.example/convite/abc';
  const email = invitationEmail('mae@exemplo.com', url, 'Marina');
  assert.equal(email.subject, 'Marina quer você na rede de apoio do SafeWalk');
  assert.ok(email.text.includes(url));
  assert.ok(email.html?.includes('Ver convite'));
});

test('servidor de e-mail lento não segura o início do trajeto: o contato aparece como enviando', async () => {
  const [contactId] = [randomUUID()];
  const late: unknown[] = [];
  let release: () => void = () => undefined;
  const slow = () => new Promise<void>((resolve) => (release = resolve));
  const previousUrl = env.PUBLIC_WEB_URL;
  env.PUBLIC_WEB_URL = urlBase;
  try {
    const result = await dispatchTripStartEmails(
      [contactId],
      [{ contactId, url: `${urlBase}/acompanhar/x`, expiresAt: new Date().toISOString() }],
      [{ id: contactId, email: 'mae@exemplo.com', accepted: true, emailTripAlerts: true }],
      { configured: true, sendEmail: slow, waitMs: 20, onLateResult: (r) => late.push(r) },
    );
    assert.deepEqual(result, [{ contactId, status: 'sending' }]);
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(late, [{ contactId, status: 'accepted_by_relay' }]);
  } finally {
    env.PUBLIC_WEB_URL = previousUrl;
  }
});
