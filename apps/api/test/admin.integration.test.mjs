import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  adminReportDetailSchema,
  adminReportListSchema,
  adminSummarySchema,
} from '@safewalk/contracts';

const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
  throw new Error('Teste de integração permitido somente no servidor local.');
const apiDirectory = fileURLToPath(new URL('..', import.meta.url));

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && typeof body !== 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  const contentType = response.headers.get('content-type') ?? '';
  return {
    status: response.status,
    contentType,
    data: contentType.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer()),
  };
}

/** Cria o operador pelo mesmo script que a equipe usa; a senha só existe neste processo de teste. */
function createOperator(role) {
  const suffix = randomBytes(5).toString('hex');
  const email = `teste-${role}-${suffix}@painel.local`;
  const password = `Senha-${randomBytes(9).toString('base64url')}`;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/modules/admin/create-admin.ts', email, `Teste ${role}`, role],
    { cwd: apiDirectory, env: { ...process.env, ADMIN_PASSWORD: password }, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { email, password };
}

async function adminToken({ email, password }) {
  const login = await request('/api/admin/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.status, 200);
  return login.data.token;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])));
  return Buffer.concat([header, data, checksum]);
}
function tinyPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', Buffer.from([0])),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test(
  'painel da Prefeitura recebe só relatos de zeladoria enviados por consentimento, sem dados pessoais',
  { timeout: 60000 },
  async (t) => {
    const health = await request('/health');
    assert.equal(health.data.demo, true, 'A API local precisa estar em modo demonstração.');
    const citizenSession = await request('/api/auth/demo', { method: 'POST' });
    const citizen = citizenSession.data.token;
    const operator = await adminToken(createOperator('operator'));
    const viewer = await adminToken(createOperator('viewer'));
    // Ponto sintético afastado do resto da base, para contar relatos próximos sem ruído.
    const jitter = Math.random() * 0.0002;
    const spot = { latitude: -23.9111 - jitter, longitude: -46.3111 - jitter };
    const make = (overrides) =>
      request('/api/reports', {
        token: citizen,
        method: 'POST',
        body: {
          type: 'pothole',
          description: 'Buraco fundo na faixa da direita',
          address: 'Rua Sintética do Painel, 100 · Teste',
          location: spot,
          shareWithGovernment: true,
          ...overrides,
        },
      });
    let potholeId;
    let trafficLightId;
    let privateId;

    await t.test('só tipos de zeladoria podem ir ao painel; crime é recusado', async () => {
      const crime = await make({ type: 'robbery' });
      assert.equal(crime.status, 400);
      assert.equal(crime.data.error.code, 'GOVERNMENT_TYPE_NOT_SUPPORTED');
      const pothole = await make({});
      assert.equal(pothole.status, 201);
      assert.equal(pothole.data.shareWithGovernment, true);
      assert.equal(pothole.data.governmentStatus, 'received');
      potholeId = pothole.data.id;
      const light = await make({
        type: 'traffic_light',
        description: 'Semáforo apagado no cruzamento',
        location: { latitude: spot.latitude + 0.0001, longitude: spot.longitude },
      });
      assert.equal(light.status, 201);
      trafficLightId = light.data.id;
      // Segundo buraco a ~20 m do primeiro: a fila os conta como o mesmo ponto.
      const second = await make({
        description: 'Outro relato do mesmo buraco',
        location: { latitude: spot.latitude + 0.0002, longitude: spot.longitude },
      });
      assert.equal(second.status, 201);
      const privateReport = await make({ shareWithGovernment: false });
      assert.equal(privateReport.status, 201);
      assert.equal(privateReport.data.governmentStatus, null);
      privateId = privateReport.data.id;
    });

    await t.test('o painel exige sessão de operador e não aceita token de usuário', async () => {
      assert.equal((await request('/api/admin/reports')).status, 401);
      assert.equal((await request('/api/admin/reports', { token: citizen })).status, 401);
      assert.equal((await request('/api/reports', { token: operator })).status, 401);
      assert.equal((await request('/api/trips', { token: operator })).status, 401);
    });

    await t.test('a fila traz os relatos enviados, sem autor e sem os privados', async () => {
      const list = await request('/api/admin/reports?status=all', { token: operator });
      assert.equal(list.status, 200);
      const parsed = adminReportListSchema.parse(list.data);
      const ids = parsed.items.map((item) => item.id);
      assert.ok(ids.includes(potholeId));
      assert.ok(ids.includes(trafficLightId));
      assert.ok(!ids.includes(privateId), 'relato privado não pode aparecer no painel');
      const text = JSON.stringify(list.data);
      for (const personal of ['user_id', 'userId', 'email', '"Leo"', citizenSession.data.user.id])
        assert.ok(!text.includes(personal), `dado pessoal vazou: ${personal}`);
      const pothole = parsed.items.find((item) => item.id === potholeId);
      const light = parsed.items.find((item) => item.id === trafficLightId);
      assert.ok(pothole.nearbyCount >= 2 && light.nearbyCount >= 1);
      assert.ok(pothole.priority !== undefined);
      assert.equal(
        (await request(`/api/admin/reports/${privateId}`, { token: operator })).status,
        404,
      );
    });

    await t.test('filtros de tipo, texto e situação', async () => {
      const onlyLights = adminReportListSchema.parse(
        (await request('/api/admin/reports?status=open&type=traffic_light', { token: operator }))
          .data,
      );
      assert.ok(onlyLights.items.length >= 1);
      assert.ok(onlyLights.items.every((item) => item.type === 'traffic_light'));
      const search = adminReportListSchema.parse(
        (
          await request('/api/admin/reports?status=all&q=Sint%C3%A9tica%20do%20Painel', {
            token: operator,
          })
        ).data,
      );
      assert.ok(search.items.some((item) => item.id === potholeId));
      const bad = await request('/api/admin/reports?status=inventado', { token: operator });
      assert.equal(bad.status, 400);
    });

    await t.test(
      'foto do relato enviado fica acessível ao painel; a de relato privado, não',
      async () => {
        const upload = (id) =>
          request(`/api/reports/${id}/photo`, {
            token: citizen,
            method: 'PUT',
            body: tinyPng().toString('base64'),
            headers: {
              'Content-Type': 'application/vnd.safewalk.image+base64',
              'X-Photo-Mime-Type': 'image/png',
            },
          });
        assert.equal((await upload(potholeId)).status, 200);
        assert.equal((await upload(privateId)).status, 200);
        const photo = await request(`/api/admin/reports/${potholeId}/photo`, { token: viewer });
        assert.equal(photo.status, 200);
        assert.equal(photo.contentType, 'image/png');
        assert.deepEqual([...photo.data.subarray(1, 4)], [80, 78, 71]);
        assert.equal(
          (await request(`/api/admin/reports/${privateId}/photo`, { token: viewer })).status,
          404,
        );
        assert.equal((await request(`/api/admin/reports/${potholeId}/photo`)).status, 401);
      },
    );

    await t.test(
      'operador muda o andamento com histórico; consulta não muda; a pessoa vê o status',
      async () => {
        const patch = (id, token, body) =>
          request(`/api/admin/reports/${id}/status`, { token, method: 'PATCH', body });
        assert.equal((await patch(potholeId, viewer, { status: 'analyzing' })).status, 403);
        assert.equal((await patch(potholeId, operator, { status: 'inventado' })).status, 400);
        const noReason = await patch(potholeId, operator, { status: 'dismissed' });
        assert.equal(noReason.status, 400);
        assert.equal(noReason.data.error.code, 'NOTE_REQUIRED');
        const analyzing = await patch(potholeId, operator, {
          status: 'analyzing',
          note: 'Vistoria agendada',
        });
        assert.equal(analyzing.status, 200);
        const detail = adminReportDetailSchema.parse(analyzing.data);
        assert.equal(detail.status, 'analyzing');
        assert.equal(detail.events[0].toStatus, 'analyzing');
        assert.equal(detail.events[0].fromStatus, 'received');
        assert.equal(detail.events[0].note, 'Vistoria agendada');
        assert.match(detail.events[0].adminName, /Teste operator/);
        assert.equal(detail.events.at(-1).toStatus, 'received');
        const same = await patch(potholeId, operator, { status: 'analyzing' });
        assert.equal(same.status, 409);
        const mine = await request(`/api/reports/${potholeId}`, { token: citizen });
        assert.equal(mine.data.governmentStatus, 'analyzing');
        assert.ok(mine.data.governmentUpdatedAt);
        const closed = await patch(potholeId, operator, {
          status: 'resolved',
          note: 'Buraco tapado',
        });
        assert.equal(closed.data.status, 'resolved');
        assert.equal(
          (await patch('00000000-0000-4000-8000-000000000000', operator, { status: 'analyzing' }))
            .status,
          404,
        );
        const open = adminReportListSchema.parse(
          (await request('/api/admin/reports?status=open', { token: operator })).data,
        );
        assert.ok(!open.items.some((item) => item.id === potholeId));
      },
    );

    await t.test(
      'o resumo tem totais, tipos em aberto, série diária e pontos críticos',
      async () => {
        const summary = adminSummarySchema.parse(
          (await request('/api/admin/summary', { token: viewer })).data,
        );
        assert.ok(summary.counts.open >= 1);
        assert.ok(summary.counts.resolved >= 1);
        assert.ok(summary.counts.resolvedLast7d >= 1);
        assert.equal(summary.daily.length, 14);
        assert.ok(summary.daily.at(-1).received >= 2);
        assert.ok(summary.averageResolutionHours !== null);
        assert.ok(summary.openByType.some((entry) => entry.type === 'traffic_light'));
        assert.ok(
          summary.hotspots.every((entry) => entry.count >= 2 && entry.address.length > 0),
          'ponto crítico exige pelo menos dois relatos em aberto',
        );
      },
    );

    await t.test('senha errada várias vezes bloqueia a conta por um tempo', async () => {
      const account = createOperator('viewer');
      for (let attempt = 0; attempt < 5; attempt++) {
        const wrong = await request('/api/admin/auth/login', {
          method: 'POST',
          body: { email: account.email, password: 'senha-errada-demais' },
        });
        assert.equal(wrong.status, 401);
      }
      const locked = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { email: account.email, password: account.password },
      });
      assert.equal(locked.status, 429);
      assert.equal(locked.data.error.code, 'ADMIN_LOCKED');
      const unknown = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { email: 'ninguem@painel.local', password: 'qualquer-coisa' },
      });
      assert.equal(unknown.status, 401);
      assert.equal(unknown.data.error.code, 'INVALID_CREDENTIALS');
    });
  },
);

// Os relatos e as contas de teste não devem aparecer no painel de demonstração depois.
after(() => {
  spawnSync(process.execPath, ['--import', 'tsx', 'src/modules/admin/cleanup-test-data.ts'], {
    cwd: apiDirectory,
    env: process.env,
    encoding: 'utf8',
  });
});
