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
  'relatos e ocorrências: propriedade, local ajustado, resolução e confirmação isolada',
  { timeout: 20000 },
  async (t) => {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.demo, true, 'A API precisa estar em modo de demonstração.');
    const owner = await request('/api/auth/demo', { method: 'POST' });
    const other = await request('/api/auth/demo', { method: 'POST' });
    assert.equal(owner.status, 201);
    assert.equal(other.status, 201);
    const token = owner.data.token;
    const otherToken = other.data.token;
    assert.ok(token && otherToken, 'As contas sintéticas precisam retornar sessões próprias.');
    assert.notEqual(owner.data.user.id, other.data.user.id);
    const location = { latitude: -23.5598765, longitude: -46.6504321 };
    const address = 'Ponto ajustado sintético · Bela Vista';
    let reportId;

    await t.test(
      'descrição opcional e ponto ajustado persistem no detalhe e na listagem',
      async () => {
        const created = await request('/api/reports', {
          token,
          method: 'POST',
          body: { type: 'aggression', address, location },
        });
        assert.equal(created.status, 201);
        reportId = created.data.id;
        assert.ok(reportId);
        assert.equal(created.data.description, '');
        assert.deepEqual(created.data.location, location);
        assert.equal(
          new Date(created.data.expiresAt).getTime() - new Date(created.data.createdAt).getTime(),
          4 * 3600000,
        );
        const detail = await request(`/api/reports/${reportId}`, { token });
        assert.equal(detail.status, 200);
        assert.equal(detail.data.description, '');
        assert.equal(detail.data.address, address);
        assert.deepEqual(detail.data.location, location);
        const list = await request('/api/reports', { token });
        assert.equal(list.status, 200);
        assert.ok(list.data.some((report) => report.id === reportId && report.address === address));
      },
    );
    assert.ok(reportId, 'A criação do relato é pré-requisito para verificar sua autorização.');

    await t.test('outra conta não consulta nem resolve o relato do titular', async () => {
      const detail = await request(`/api/reports/${reportId}`, { token: otherToken });
      assert.equal(detail.status, 404);
      assert.equal(detail.data.error.code, 'REPORT_NOT_FOUND');
      const resolution = await request(`/api/reports/${reportId}/resolve`, {
        token: otherToken,
        method: 'POST',
      });
      assert.equal(resolution.status, 404);
      assert.equal(resolution.data.error.code, 'REPORT_NOT_FOUND');
      assert.equal((await request(`/api/reports/${reportId}`, { token })).data.status, 'active');
      const otherList = await request('/api/reports', { token: otherToken });
      assert.ok(!otherList.data.some((report) => report.id === reportId));
    });

    await t.test(
      'o titular resolve uma única vez e a repetição mantém o mesmo estado',
      async () => {
        const first = await request(`/api/reports/${reportId}/resolve`, { token, method: 'POST' });
        const again = await request(`/api/reports/${reportId}/resolve`, { token, method: 'POST' });
        assert.equal(first.status, 200);
        assert.equal(first.data.status, 'resolved');
        assert.equal(again.status, 200);
        assert.deepEqual(again.data, first.data);
        assert.equal(
          (await request(`/api/reports/${reportId}`, { token })).data.status,
          'resolved',
        );
      },
    );

    await t.test(
      'confirmar uma ocorrência duas vezes não duplica a contagem e a escolha persiste',
      async () => {
        const initial = await request('/api/incidents/roubo/feedback', { token });
        assert.equal(initial.status, 200);
        assert.equal(initial.data.choice, null);
        const first = await request('/api/incidents/roubo/feedback', {
          token,
          method: 'PUT',
          body: { choice: 'confirm' },
        });
        const again = await request('/api/incidents/roubo/feedback', {
          token,
          method: 'PUT',
          body: { choice: 'confirm' },
        });
        assert.equal(first.status, 200);
        assert.equal(first.data.choice, 'confirm');
        assert.equal(first.data.confirmations, initial.data.confirmations + 1);
        assert.equal(first.data.simulated, true);
        assert.equal(again.status, 200);
        assert.deepEqual(again.data, first.data);
        assert.deepEqual(
          (await request('/api/incidents/roubo/feedback', { token })).data,
          first.data,
        );
      },
    );

    await t.test(
      'cada conta mantém sua própria confirmação sem alterar a escolha de outra',
      async () => {
        const initialOther = await request('/api/incidents/roubo/feedback', { token: otherToken });
        assert.equal(initialOther.status, 200);
        assert.equal(initialOther.data.choice, null);
        const ownerFeedback = (await request('/api/incidents/roubo/feedback', { token })).data;
        assert.equal(initialOther.data.confirmations, ownerFeedback.confirmations - 1);
        const changed = await request('/api/incidents/roubo/feedback', {
          token: otherToken,
          method: 'PUT',
          body: { choice: 'resolved' },
        });
        assert.equal(changed.status, 200);
        assert.equal(changed.data.choice, 'resolved');
        assert.equal(changed.data.confirmations, initialOther.data.confirmations);
        assert.deepEqual(
          (await request('/api/incidents/roubo/feedback', { token })).data,
          ownerFeedback,
        );
      },
    );

    await t.test('a exportação inclui apenas relatos e respostas da própria conta', async () => {
      const ownExport = await request('/api/auth/export', { token });
      const otherExport = await request('/api/auth/export', { token: otherToken });
      assert.equal(ownExport.status, 200);
      assert.equal(otherExport.status, 200);
      assert.equal(ownExport.data.profile.id, owner.data.user.id);
      assert.equal(otherExport.data.profile.id, other.data.user.id);
      assert.ok(ownExport.data.data.reports.some((report) => report.id === reportId));
      assert.ok(!otherExport.data.data.reports.some((report) => report.id === reportId));
      assert.deepEqual(
        ownExport.data.data.incidentFeedback.map(({ incident_id, choice }) => ({
          incident_id,
          choice,
        })),
        [{ incident_id: 'roubo', choice: 'confirm' }],
      );
      assert.deepEqual(
        otherExport.data.data.incidentFeedback.map(({ incident_id, choice }) => ({
          incident_id,
          choice,
        })),
        [{ incident_id: 'roubo', choice: 'resolved' }],
      );
    });
  },
);
