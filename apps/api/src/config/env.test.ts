import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnv } from './env-schema.js';

const valid = {
  DB_NAME: 'safewalk',
  DB_USER: 'safewalk_app',
  DB_PASSWORD: 'senha-forte-do-banco',
  JWT_SECRET: 'x'.repeat(40),
};
const production = { ...valid, NODE_ENV: 'production', ALERT_WORKER_ENABLED: 'true' };

function issuePaths(source: Record<string, string>): string[] {
  try {
    parseEnv(source);
    return [];
  } catch (error) {
    return (error as { issues: { path: string[] }[] }).issues.map((issue) => issue.path.join('.'));
  }
}

test('desenvolvimento aceita padrões e TRUST_PROXY desligado', () => {
  const parsed = parseEnv(valid);
  assert.equal(parsed.TRUST_PROXY, 0);
  assert.equal(parsed.GEOGRAPHIC_SERVICES_ENABLED, 'true');
});

test('TRUST_PROXY aceita inteiros não negativos e rejeita inválidos', () => {
  assert.equal(parseEnv({ ...valid, TRUST_PROXY: '1' }).TRUST_PROXY, 1);
  assert.deepEqual(issuePaths({ ...valid, TRUST_PROXY: '-1' }), ['TRUST_PROXY']);
});

test('produção correta é aceita', () => {
  assert.equal(parseEnv(production).NODE_ENV, 'production');
});

test('produção rejeita segredos de exemplo, demonstração e worker desligado', () => {
  assert.deepEqual(
    issuePaths({ ...production, JWT_SECRET: 'replace-with-random-secret-at-least-32-characters' }),
    ['JWT_SECRET'],
  );
  assert.deepEqual(
    issuePaths({ ...production, DB_PASSWORD: 'replace-with-local-database-password' }),
    ['DB_PASSWORD'],
  );
  assert.deepEqual(issuePaths({ ...production, DEMO_MODE: 'true' }), ['DEMO_MODE']);
  assert.deepEqual(issuePaths({ ...production, ALERT_WORKER_ENABLED: 'false' }), [
    'ALERT_WORKER_ENABLED',
  ]);
});

test('mensagens de validação não revelam o segredo', () => {
  const secret = 'replace-with-' + 'y'.repeat(30);
  try {
    parseEnv({ ...production, JWT_SECRET: secret });
    assert.fail('deveria rejeitar');
  } catch (error) {
    assert.ok(!JSON.stringify((error as { issues: unknown }).issues).includes(secret));
  }
});

test('desenvolvimento tolera worker desligado e demonstração', () => {
  assert.doesNotThrow(() =>
    parseEnv({ ...valid, DEMO_MODE: 'true', ALERT_WORKER_ENABLED: 'false' }),
  );
});
