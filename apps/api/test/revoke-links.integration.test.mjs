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

const trackingPath = (url) => new URL(url).pathname.replace('/acompanhar/', '/api/tracking/');

test('titular revoga o link de um contato sem afetar os demais nem outro usuário', async () => {
  const { token } = (await request('/api/auth/demo', { method: 'POST' })).data;
  const contacts = (await request('/api/contacts', { token })).data;
  const started = (
    await request('/api/trips', {
      token,
      method: 'POST',
      body: {
        routeKind: 'safer',
        destination: 'Casa · teste de revogação',
        contactIds: contacts.map((contact) => contact.id),
      },
    })
  ).data;
  const [revokedLink, keptLink] = started.links;
  assert.ok(revokedLink && keptLink, 'a conta de demonstração tem dois contatos');
  const revokePath = `/api/trips/${started.trip.id}/shares/${revokedLink.contactId}`;

  const other = (await request('/api/auth/demo', { method: 'POST' })).data;
  assert.equal((await request(revokePath, { token: other.token, method: 'DELETE' })).status, 404);
  assert.equal((await request(trackingPath(revokedLink.url))).status, 200);

  const revoked = await request(revokePath, { token, method: 'DELETE' });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.data.revokedLinks, 1);
  const again = await request(revokePath, { token, method: 'DELETE' });
  assert.equal(again.data.revokedLinks, 0, 'revogar de novo é idempotente');

  const expired = await request(trackingPath(revokedLink.url));
  assert.equal(expired.status, 410);
  assert.equal(expired.data.error.code, 'LINK_EXPIRED');
  assert.equal((await request(trackingPath(keptLink.url))).status, 200);

  await request(`/api/trips/${started.trip.id}/finish`, {
    token,
    method: 'POST',
    body: { pin: '1234', outcome: 'arrived' },
  });
});
