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

test(
  'API e MariaDB: isolamento, concorrência, PIN, convite, prazo real e revogação',
  { timeout: 55000 },
  async (t) => {
    assert.equal(
      (await request('/health')).data.demo,
      true,
      'A API precisa estar em modo de demonstração.',
    );
    const demo = (await request('/api/auth/demo', { method: 'POST' })).data;
    assert.ok(demo.token);
    const token = demo.token;
    let tripId;
    try {
      const contacts = (await request('/api/contacts', { token })).data;
      const body = {
        routeKind: 'safer',
        destination: 'Casa · teste automatizado',
        contactIds: contacts.map((contact) => contact.id),
      };
      const starts = await Promise.all([
        request('/api/trips', { token, method: 'POST', body }),
        request('/api/trips', { token, method: 'POST', body }),
      ]);
      assert.deepEqual(starts.map((result) => result.status).sort(), [201, 409]);
      const created = starts.find((result) => result.status === 201).data;
      tripId = created.trip.id;
      const trackingPath = new URL(created.links[0].url).pathname.replace(
        '/acompanhar/',
        '/api/tracking/',
      );
      await t.test('contato não confirma alerta inexistente', async () => {
        assert.equal(
          (await request(`${trackingPath}/acknowledge`, { method: 'POST' })).status,
          409,
        );
      });
      await t.test('outro usuário não acessa o trajeto', async () => {
        const other = (await request('/api/auth/demo', { method: 'POST' })).data;
        assert.equal((await request(`/api/trips/${tripId}`, { token: other.token })).status, 404);
      });
      await t.test('localização futura é recusada e posição válida chega ao contato', async () => {
        const position = {
          latitude: -23.562,
          longitude: -46.652,
          accuracyMeters: 8,
          recordedAt: new Date(Date.now() + 3600000).toISOString(),
        };
        assert.equal(
          (
            await request(`/api/trips/${tripId}/positions`, {
              token,
              method: 'POST',
              body: position,
            })
          ).status,
          400,
        );
        position.recordedAt = new Date().toISOString();
        assert.equal(
          (
            await request(`/api/trips/${tripId}/positions`, {
              token,
              method: 'POST',
              body: position,
            })
          ).status,
          204,
        );
        assert.equal(
          (await request(trackingPath)).data.trip.lastPosition.latitude,
          position.latitude,
        );
      });
      await t.test('PIN errado mantém o trajeto ativo', async () => {
        assert.equal(
          (
            await request(`/api/trips/${tripId}/finish`, {
              token,
              method: 'POST',
              body: { pin: '9999', outcome: 'arrived' },
            })
          ).status,
          403,
        );
        assert.equal((await request(`/api/trips/${tripId}`, { token })).data.status, 'active');
      });
      await t.test(
        'convite exige consentimento, aceita uma única resposta e atualiza o contato',
        async () => {
          const contact = (
            await request('/api/contacts', {
              token,
              method: 'POST',
              body: { name: 'Contato de teste', phone: '+5511900000003' },
            })
          ).data;
          const invitation = (
            await request(`/api/contacts/${contact.id}/invitation`, { token, method: 'POST' })
          ).data;
          const path = new URL(invitation.url).pathname.replace('/convite/', '/api/invitations/');
          assert.equal(
            (await request(path, { method: 'POST', body: { accepted: true, consent: false } }))
              .status,
            400,
          );
          assert.equal(
            (await request(path, { method: 'POST', body: { accepted: true, consent: true } }))
              .status,
            200,
          );
          assert.equal(
            (await request(path, { method: 'POST', body: { accepted: false, consent: false } }))
              .status,
            409,
          );
          assert.equal(
            (await request('/api/contacts', { token })).data.find((item) => item.id === contact.id)
              .accepted,
            true,
          );
        },
      );
      await t.test('relato fica persistido com acesso do autor', async () => {
        const report = (
          await request('/api/reports', {
            token,
            method: 'POST',
            body: {
              type: 'lighting',
              description: 'Iluminação de teste para integração.',
              address: 'Bela Vista · teste',
              location: { latitude: -23.56, longitude: -46.65 },
            },
          })
        ).data;
        assert.ok(
          (await request('/api/reports', { token })).data.some((item) => item.id === report.id),
        );
      });
      await t.test('processador aplica o prazo de 30 segundos sem ação do cliente', async () => {
        const result = await request(`/api/trips/${tripId}/alerts`, {
          token,
          method: 'POST',
          body: { reason: 'stopped' },
        });
        assert.equal(result.data.status, 'checkin_pending');
        assert.equal(
          (await request(`${trackingPath}/acknowledge`, { method: 'POST' })).status,
          409,
          'contato não confirma um alerta que ainda não foi enviado',
        );
        const deadline = Date.now() + 40000;
        let status = result.data.status;
        while (Date.now() < deadline && status === 'checkin_pending') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          status = (await request(`/api/trips/${tripId}`, { token })).data.status;
        }
        assert.equal(status, 'alerted');
      });
      await t.test('confirmação do contato não cancela SOS; cancelamento exige PIN', async () => {
        assert.equal(
          (await request(`${trackingPath}/acknowledge`, { method: 'POST' })).status,
          200,
        );
        assert.equal((await request(`/api/trips/${tripId}`, { token })).data.status, 'alerted');
        assert.equal(
          (
            await request(`/api/trips/${tripId}/cancel-alert`, {
              token,
              method: 'POST',
              body: { pin: '1234' },
            })
          ).data.status,
          'active',
        );
      });
      await t.test('encerramento revoga imediatamente o link de acompanhamento', async () => {
        assert.equal(
          (
            await request(`/api/trips/${tripId}/finish`, {
              token,
              method: 'POST',
              body: { pin: '1234', outcome: 'arrived' },
            })
          ).data.status,
          'arrived',
        );
        assert.equal((await request(trackingPath)).status, 410);
      });
    } finally {
      if (tripId)
        await request(`/api/trips/${tripId}/finish`, {
          token,
          method: 'POST',
          body: { pin: '1234', outcome: 'cancelled' },
        });
    }
  },
);
