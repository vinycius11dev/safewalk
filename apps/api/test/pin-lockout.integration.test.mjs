import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(origin).hostname))
  throw new Error('Teste de integração permitido somente no servidor local.');

async function request(path, { token, body, method = 'GET' } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: response.status === 204 ? undefined : await response.json(),
  };
}

test('PIN: erros repetidos bloqueiam no banco e o acerto zera o contador', async () => {
  const { token } = (await request('/api/auth/demo', { method: 'POST' })).data;
  const contacts = (await request('/api/contacts', { token })).data;
  const trip = (
    await request('/api/trips', {
      token,
      method: 'POST',
      body: {
        routeKind: 'safer',
        destination: 'Casa · teste de bloqueio de PIN',
        contactIds: contacts.map((contact) => contact.id),
      },
    })
  ).data.trip;
  const tryPin = (pin) =>
    request(`/api/trips/${trip.id}/cancel-alert`, { token, method: 'POST', body: { pin } });

  assert.equal((await tryPin('0000')).status, 403);
  assert.equal((await tryPin('0000')).status, 403);
  assert.equal((await tryPin('1234')).status, 200, 'o PIN correto é aceito antes do bloqueio');

  for (let attempt = 1; attempt <= 5; attempt++)
    assert.equal(
      (await tryPin('0000')).status,
      403,
      `erro ${attempt} depois do acerto: o contador recomeçou`,
    );
  const locked = await tryPin('1234');
  assert.equal(locked.status, 429);
  assert.equal(locked.data.error.code, 'PIN_LOCKED');
});
