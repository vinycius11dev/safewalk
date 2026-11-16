import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
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
  'telas de trajeto: preferências reais, SOS imediato, avaliação e chegada sem localização',
  { timeout: 20000 },
  async (t) => {
    assert.equal(
      (await request('/health')).data.demo,
      true,
      'É obrigatório usar a API local em demonstração.',
    );
    const demo = await request('/api/auth/demo', { method: 'POST' });
    assert.equal(demo.status, 201);
    const token = demo.data.token;
    assert.ok(token, 'A demonstração precisa retornar uma sessão autenticada.');
    let tripId;
    try {
      const contactsResponse = await request('/api/contacts', { token });
      assert.equal(
        contactsResponse.status,
        200,
        `Contatos indisponíveis: ${contactsResponse.data.error?.code ?? 'sem código'}`,
      );
      const contacts = contactsResponse.data;
      assert.ok(
        Array.isArray(contacts) && contacts.length > 0,
        'A conta demo precisa ter seus contatos sintéticos.',
      );
      const created = await request('/api/trips', {
        token,
        method: 'POST',
        body: {
          routeKind: 'safer',
          destination: 'Destino sintético de validação',
          contactIds: [contacts[0].id],
        },
      });
      assert.equal(created.status, 201);
      tripId = created.data.trip.id;
      const path = `/api/trips/${tripId}`;
      const trackingPath = new URL(created.data.links[0].url).pathname.replace(
        '/acompanhar/',
        '/api/tracking/',
      );
      const settings = (await request('/api/auth/settings', { token })).data;

      await t.test('avaliação só é permitida após encerrar e respeita o titular', async () => {
        assert.equal(
          (await request(`${path}/feedback`, { token, method: 'POST', body: { feeling: 'safe' } }))
            .status,
          409,
        );
        const other = (await request('/api/auth/demo', { method: 'POST' })).data;
        assert.equal(
          (
            await request(`${path}/feedback`, {
              token: other.token,
              method: 'POST',
              body: { feeling: 'unsafe' },
            })
          ).status,
          404,
        );
      });
      await t.test('parada usa os 15 segundos escolhidos pelo usuário', async () => {
        assert.equal(
          (
            await request('/api/auth/settings', {
              token,
              method: 'PUT',
              body: {
                ...settings,
                responseSeconds: 15,
                automaticDetection: true,
                arrivalCheckin: true,
              },
            })
          ).status,
          200,
        );
        const before = Date.now();
        const result = await request(`${path}/alerts`, {
          token,
          method: 'POST',
          body: { reason: 'stopped' },
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.status, 'checkin_pending');
        assert.equal(result.data.alertReason, 'stopped');
        const deadline = new Date(result.data.alertDeadline).getTime() - before;
        assert.ok(
          deadline >= 14000 && deadline <= 17000,
          'O prazo precisa refletir a preferência persistida.',
        );
      });
      await t.test('pedido manual durante check-in abre SOS imediatamente', async () => {
        const result = await request(`${path}/alerts`, {
          token,
          method: 'POST',
          body: { reason: 'manual' },
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.status, 'alerted');
        assert.equal(result.data.alertReason, 'manual');
        assert.equal(result.data.alertDeadline, null);
        assert.equal(
          (await request(`${path}/cancel-alert`, { token, method: 'POST', body: { pin: '1234' } }))
            .data.alertReason,
          null,
        );
      });
      await t.test(
        'preferências desativam disparos automáticos e preservam SOS manual',
        async () => {
          assert.equal(
            (
              await request('/api/auth/settings', {
                token,
                method: 'PUT',
                body: {
                  ...settings,
                  automaticDetection: false,
                  arrivalCheckin: false,
                  currentPin: '1234',
                },
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request(`${path}/alerts`, {
                token,
                method: 'POST',
                body: { reason: 'stopped' },
              })
            ).data.error.code,
            'AUTOMATIC_DETECTION_DISABLED',
          );
          assert.equal(
            (await request(`${path}/alerts`, { token, method: 'POST', body: { reason: 'late' } }))
              .data.error.code,
            'ARRIVAL_CHECKIN_DISABLED',
          );
          assert.equal(
            (await request(`${path}/alerts`, { token, method: 'POST', body: { reason: 'manual' } }))
              .data.status,
            'alerted',
          );
          assert.equal(
            (
              await request(`${path}/cancel-alert`, {
                token,
                method: 'POST',
                body: { pin: '1234' },
              })
            ).data.status,
            'active',
          );
        },
      );
      await t.test(
        'chegada revoga os dados e mantém só a confirmação genérica enquanto o link está no prazo',
        async () => {
          assert.equal(
            (
              await request(`${path}/finish`, {
                token,
                method: 'POST',
                body: { pin: '1234', outcome: 'arrived' },
              })
            ).data.status,
            'arrived',
          );
          assert.equal(
            (
              await request(`${path}/feedback`, {
                token,
                method: 'POST',
                body: { feeling: 'safe' },
              })
            ).data.feedback,
            'safe',
          );
          assert.equal((await request(path, { token })).data.feedback, 'safe');
          const tracking = await request(trackingPath);
          assert.equal(tracking.status, 410);
          assert.equal(tracking.data.error.code, 'TRIP_ARRIVED');
          assert.deepEqual(Object.keys(tracking.data), ['error']);
          assert.doesNotMatch(
            JSON.stringify(tracking.data),
            /latitude|longitude|lastPosition|travelerPhone|travelerName/,
          );
        },
      );
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
