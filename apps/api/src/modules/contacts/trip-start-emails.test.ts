import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../config/env.js';
import type { TripStartEmailTarget } from './contacts.repository.js';
import { dispatchTripStartEmails } from './trip-start-emails.js';

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
