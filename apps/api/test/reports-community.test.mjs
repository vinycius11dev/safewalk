import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
  throw new Error('Teste de integração permitido somente no servidor local.');

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
    data:
      response.status === 204
        ? undefined
        : contentType.includes('application/json')
          ? await response.json()
          : await response.text(),
  };
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
function pngWithExif() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('eXIf', Buffer.from('GPS-LOCATION')),
    pngChunk('IDAT', Buffer.from([0])),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test(
  'community road reports honor sharing consent, coarse location, photo access, feedback, and flags',
  { timeout: 30000 },
  async (t) => {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.equal(
      health.data.demo,
      true,
      'The API must run in demo mode for this local integration test.',
    );

    const sessions = await Promise.all(
      Array.from({ length: 4 }, () => request('/api/auth/demo', { method: 'POST' })),
    );
    sessions.forEach((session) => assert.equal(session.status, 201));
    const [author, one, two, three] = sessions.map((session) => session.data.token);
    const center = { latitude: -23.5598765, longitude: -46.6504321 };
    const address = 'Ponto comunitário sintético · Bela Vista';
    let communityId;
    let privateId;

    await t.test(
      'publication is rejected when account-level contribution consent is off',
      async () => {
        const settings = await request('/api/auth/settings', { token: author });
        const disabled = await request('/api/auth/settings', {
          token: author,
          method: 'PUT',
          body: { ...settings.data, contributeReports: false },
        });
        assert.equal(disabled.status, 200);
        const rejected = await request('/api/reports', {
          token: author,
          method: 'POST',
          body: {
            type: 'obstruction',
            description: '',
            address,
            location: center,
            shareWithCommunity: true,
          },
        });
        assert.equal(rejected.status, 403);
        assert.equal(rejected.data.error.code, 'COMMUNITY_SHARING_DISABLED');
      },
    );

    const currentSettings = await request('/api/auth/settings', { token: author });
    await request('/api/auth/settings', {
      token: author,
      method: 'PUT',
      body: { ...currentSettings.data, contributeReports: true },
    });

    await t.test(
      'shared obstacle is coarsened and visible only to other authenticated users',
      async () => {
        const created = await request('/api/reports', {
          token: author,
          method: 'POST',
          body: {
            type: 'obstruction',
            description: 'Obra bloqueia a passagem',
            address,
            location: center,
            shareWithCommunity: true,
          },
        });
        assert.equal(created.status, 201);
        communityId = created.data.id;
        assert.equal(created.data.shareWithCommunity, true);
        assert.equal(created.data.hasPhoto, false);
        assert.equal(
          new Date(created.data.expiresAt).getTime() - new Date(created.data.createdAt).getTime(),
          6 * 60 * 60 * 1000,
        );
        assert.deepEqual(
          created.data.location,
          center,
          'The owner keeps the exact report location.',
        );

        const publicList = await request(
          `/api/reports/nearby?lat=${center.latitude}&lon=${center.longitude}&radius=1500`,
          { token: one },
        );
        const published = publicList.data.find((report) => report.id === communityId);
        assert.ok(published);
        assert.notDeepEqual(
          published.location,
          center,
          'Other people only see the coarsened point.',
        );
        assert.equal(published.myChoice, null);

        const selfList = await request(
          `/api/reports/nearby?lat=${center.latitude}&lon=${center.longitude}&radius=1500`,
          { token: author },
        );
        assert.ok(!selfList.data.some((report) => report.id === communityId));

        const privateReport = await request('/api/reports', {
          token: author,
          method: 'POST',
          body: {
            type: 'obstruction',
            description: '',
            address,
            location: center,
            shareWithCommunity: false,
          },
        });
        assert.equal(privateReport.status, 201);
        privateId = privateReport.data.id;
        const otherDetail = await request(`/api/reports/${privateId}`, { token: one });
        assert.equal(otherDetail.status, 404);
      },
    );

    await t.test(
      'owner photo upload strips PNG metadata; community photo access requires live consent',
      async () => {
        const image = pngWithExif();
        const upload = await request(`/api/reports/${communityId}/photo`, {
          token: author,
          method: 'PUT',
          body: image.toString('base64'),
          headers: {
            'Content-Type': 'application/vnd.safewalk.image+base64',
            'X-Photo-Mime-Type': 'image/png',
          },
        });
        assert.equal(upload.status, 200);
        assert.equal(upload.data.hasPhoto, true);
        const ownerPhoto = await request(`/api/reports/${communityId}/photo`, { token: author });
        assert.equal(ownerPhoto.status, 200);
        assert.equal(ownerPhoto.data.mimeType, 'image/png');
        const clean = Buffer.from(ownerPhoto.data.data, 'base64');
        assert.ok(!clean.includes(Buffer.from('eXIf')));
        assert.ok(!clean.includes(Buffer.from('GPS-LOCATION')));
        const otherPhoto = await request(`/api/reports/${communityId}/photo`, { token: one });
        assert.equal(otherPhoto.status, 200);
        assert.equal(otherPhoto.data.data, ownerPhoto.data.data);
        const privatePhoto = await request(`/api/reports/${privateId}/photo`, { token: one });
        assert.equal(privatePhoto.status, 404);
        const wrongType = await request(`/api/reports/${communityId}/photo`, {
          token: author,
          method: 'PUT',
          body: image.toString('base64'),
          headers: {
            'Content-Type': 'application/vnd.safewalk.image+base64',
            'X-Photo-Mime-Type': 'image/gif',
          },
        });
        assert.equal(wrongType.status, 400);

        const settings = await request('/api/auth/settings', { token: author });
        await request('/api/auth/settings', {
          token: author,
          method: 'PUT',
          body: { ...settings.data, contributeReports: false },
        });
        const disabledPhoto = await request(`/api/reports/${communityId}/photo`, { token: one });
        assert.equal(disabledPhoto.status, 404);
        const hiddenFromNearby = await request(
          `/api/reports/nearby?lat=${center.latitude}&lon=${center.longitude}&radius=1500`,
          { token: one },
        );
        assert.ok(!hiddenFromNearby.data.some((report) => report.id === communityId));
        await request('/api/auth/settings', {
          token: author,
          method: 'PUT',
          body: { ...settings.data, contributeReports: true },
        });
      },
    );

    await t.test(
      'one vote per user updates counts; author cannot vote on their own report',
      async () => {
        const selfVote = await request(`/api/reports/${communityId}/feedback`, {
          token: author,
          method: 'PUT',
          body: { choice: 'present' },
        });
        assert.equal(selfVote.status, 404);
        const first = await request(`/api/reports/${communityId}/feedback`, {
          token: one,
          method: 'PUT',
          body: { choice: 'present' },
        });
        const duplicate = await request(`/api/reports/${communityId}/feedback`, {
          token: one,
          method: 'PUT',
          body: { choice: 'present' },
        });
        assert.equal(first.data.confirmationCount, 1);
        assert.deepEqual(duplicate.data, first.data);
        const changed = await request(`/api/reports/${communityId}/feedback`, {
          token: one,
          method: 'PUT',
          body: { choice: 'resolved' },
        });
        assert.equal(changed.data.confirmationCount, 0);
        assert.equal(changed.data.resolvedCount, 1);
        assert.equal(changed.data.myChoice, 'resolved');
      },
    );

    await t.test(
      'three distinct flags hide a community report from public results and photo access',
      async () => {
        const flags = [];
        for (const token of [one, two, three])
          flags.push(await request(`/api/reports/${communityId}/flag`, { token, method: 'POST' }));
        assert.deepEqual(
          flags.map((response) => response.data.hidden),
          [false, false, true],
        );
        const hiddenPhoto = await request(`/api/reports/${communityId}/photo`, { token: one });
        assert.equal(hiddenPhoto.status, 404);
        const nearby = await request(
          `/api/reports/nearby?lat=${center.latitude}&lon=${center.longitude}&radius=1500`,
          { token: one },
        );
        assert.ok(!nearby.data.some((report) => report.id === communityId));
      },
    );

    await t.test(
      'community endpoints require a session and malformed feedback is rejected',
      async () => {
        const unauthenticated = await request(
          `/api/reports/nearby?lat=${center.latitude}&lon=${center.longitude}`,
        );
        assert.equal(unauthenticated.status, 401);
        const invalid = await request(`/api/reports/${communityId}/feedback`, {
          token: one,
          method: 'PUT',
          body: { choice: 'maybe' },
        });
        assert.equal(invalid.status, 400);
      },
    );
  },
);
