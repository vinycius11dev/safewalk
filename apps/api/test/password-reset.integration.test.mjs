import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { passwordResetRequestResponseSchema } from '@safewalk/contracts';

/**
 * Recuperação de senha no servidor local (sem SMTP, fora de produção): a API devolve o link em
 * `previewUrl`, que faz o papel do e-mail.
 */
const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
  throw new Error('Teste de integração permitido somente no servidor local.');
const apiDirectory = fileURLToPath(new URL('..', import.meta.url));

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}

const tokenOf = (previewUrl) => new URL(previewUrl).searchParams.get('token');

async function forgot(prefix, email) {
  const response = await request(`${prefix}/password/forgot`, {
    method: 'POST',
    body: { email },
  });
  assert.equal(response.status, 202);
  return passwordResetRequestResponseSchema.parse(response.data);
}

after(() => {
  spawnSync(process.execPath, ['--import', 'tsx', 'src/modules/admin/cleanup-test-data.ts'], {
    cwd: apiDirectory,
    encoding: 'utf8',
  });
});

test('app user resets the password by link and old sessions end', async () => {
  const email = `reset-${randomBytes(5).toString('hex')}@example.com`;
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Pessoa Teste', email, password: 'senha-antiga-123' },
  });
  assert.equal(registered.status, 201);
  const oldSession = registered.data.token;

  const unknown = await forgot(
    '/api/auth',
    `ninguem-${randomBytes(4).toString('hex')}@example.com`,
  );
  const known = await forgot('/api/auth', email);
  assert.equal(unknown.message, known.message, 'a mensagem não revela se a conta existe');
  assert.equal(unknown.previewUrl, undefined);
  assert.ok(known.previewUrl);
  assert.equal(new URL(known.previewUrl).pathname, '/redefinir-senha');

  // Pedir de novo invalida o link anterior.
  const second = await forgot('/api/auth', email);
  const stale = await request('/api/auth/password/reset', {
    method: 'POST',
    body: { token: tokenOf(known.previewUrl), password: 'nova-senha-123' },
  });
  assert.equal(stale.status, 400);
  assert.equal(stale.data.error.code, 'RESET_LINK_INVALID');

  const weak = await request('/api/auth/password/reset', {
    method: 'POST',
    body: { token: tokenOf(second.previewUrl), password: '123' },
  });
  assert.equal(weak.status, 400);

  // Garante um segundo de diferença entre a sessão antiga e a troca de senha.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const reset = await request('/api/auth/password/reset', {
    method: 'POST',
    body: { token: tokenOf(second.previewUrl), password: 'nova-senha-123' },
  });
  assert.equal(reset.status, 204);

  const reused = await request('/api/auth/password/reset', {
    method: 'POST',
    body: { token: tokenOf(second.previewUrl), password: 'outra-senha-123' },
  });
  assert.equal(reused.status, 400);

  const oldMe = await request('/api/auth/me', { token: oldSession });
  assert.equal(oldMe.status, 401);
  assert.equal(oldMe.data.error.code, 'SESSION_EXPIRED');

  const oldPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'senha-antiga-123' },
  });
  assert.equal(oldPassword.status, 401);
  const newPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'nova-senha-123' },
  });
  assert.equal(newPassword.status, 200);
  const me = await request('/api/auth/me', { token: newPassword.data.token });
  assert.equal(me.status, 200);
});

test('more than three requests per hour stop issuing links', async () => {
  const email = `reset-limit-${randomBytes(5).toString('hex')}@example.com`;
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Pessoa Limite', email, password: 'senha-limite-123' },
  });
  assert.equal(registered.status, 201);
  for (let attempt = 0; attempt < 3; attempt += 1)
    assert.ok((await forgot('/api/auth', email)).previewUrl);
  const blocked = await forgot('/api/auth', email);
  assert.equal(blocked.previewUrl, undefined);
});

test('panel operator resets the password with the longer panel rule', async () => {
  const email = `teste-reset-${randomBytes(5).toString('hex')}@painel.local`;
  const created = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/modules/admin/create-admin.ts', email, 'Teste reset', 'operator'],
    {
      cwd: apiDirectory,
      env: { ...process.env, ADMIN_PASSWORD: `Senha-${randomBytes(9).toString('base64url')}` },
      encoding: 'utf8',
    },
  );
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const requested = await forgot('/api/admin/auth', email);
  assert.ok(requested.previewUrl);
  assert.equal(new URL(requested.previewUrl).pathname, '/redefinir-senha');
  const token = tokenOf(requested.previewUrl);

  // A senha do app (8+) não basta no painel (12+).
  const short = await request('/api/admin/auth/password/reset', {
    method: 'POST',
    body: { token, password: 'curta-1234' },
  });
  assert.equal(short.status, 400);

  // Um link do painel não serve para conta do app.
  const wrongSite = await request('/api/auth/password/reset', {
    method: 'POST',
    body: { token, password: 'senha-valida-do-painel' },
  });
  assert.equal(wrongSite.status, 400);

  const reset = await request('/api/admin/auth/password/reset', {
    method: 'POST',
    body: { token, password: 'senha-valida-do-painel' },
  });
  assert.equal(reset.status, 204);
  const login = await request('/api/admin/auth/login', {
    method: 'POST',
    body: { email, password: 'senha-valida-do-painel' },
  });
  assert.equal(login.status, 200);
  const me = await request('/api/admin/auth/me', { token: login.data.token });
  assert.equal(me.status, 200);
});
