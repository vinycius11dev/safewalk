import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../config/env.js';
import { dataBlock, smtpConfigFromEnvironment } from './smtp.js';

const decodedParts = (block: string) =>
  [
    ...block.matchAll(
      /Content-Type: (text\/\w+); charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n(?:--|\.)/g,
    ),
  ].map(([, type, body]) => ({ type, body: Buffer.from(body ?? '', 'base64').toString('utf8') }));

test('plain emails keep a single text part', () => {
  const block = dataBlock({ to: 'a@b.com', subject: 'Olá', text: 'Linha 1\nLinha 2' }, 'x@y.com');
  assert.equal(block.includes('multipart'), false);
  assert.deepEqual(decodedParts(block), [{ type: 'text/plain', body: 'Linha 1\r\nLinha 2' }]);
  assert.ok(block.endsWith('\r\n.\r\n'));
});

test('emails with html go as multipart/alternative with the text first', () => {
  const block = dataBlock(
    { to: 'a@b.com', subject: 'Olá', text: 'Senha', html: '<p>Senha</p>' },
    'x@y.com',
  );
  const boundary = /boundary="([^"]+)"/.exec(block)?.[1];
  assert.ok(boundary);
  assert.ok(block.includes(`\r\n--${boundary}--\r\n.\r\n`));
  assert.deepEqual(
    decodedParts(block).map((part) => part.type),
    ['text/plain', 'text/html'],
  );
  assert.equal(decodedParts(block)[1]?.body, '<p>Senha</p>');
});

test('SMTP is always disabled in demo mode even when credentials are present', () => {
  const previous = {
    demo: env.DEMO_MODE,
    publicUrl: env.PUBLIC_WEB_URL,
    host: env.SAFEWALK_SMTP_HOST,
    user: env.SAFEWALK_SMTP_USER,
    password: env.SAFEWALK_SMTP_PASSWORD,
    from: env.SAFEWALK_SMTP_FROM,
    secure: env.SAFEWALK_SMTP_SECURE,
  };
  try {
    env.DEMO_MODE = 'true';
    env.PUBLIC_WEB_URL = 'https://safewalk.example';
    env.SAFEWALK_SMTP_HOST = 'smtp.example';
    env.SAFEWALK_SMTP_USER = 'user';
    env.SAFEWALK_SMTP_PASSWORD = 'password';
    env.SAFEWALK_SMTP_FROM = 'noreply@safewalk.example';
    env.SAFEWALK_SMTP_SECURE = 'true';
    assert.equal(smtpConfigFromEnvironment(), null);
  } finally {
    env.DEMO_MODE = previous.demo;
    env.PUBLIC_WEB_URL = previous.publicUrl;
    env.SAFEWALK_SMTP_HOST = previous.host;
    env.SAFEWALK_SMTP_USER = previous.user;
    env.SAFEWALK_SMTP_PASSWORD = previous.password;
    env.SAFEWALK_SMTP_FROM = previous.from;
    env.SAFEWALK_SMTP_SECURE = previous.secure;
  }
});

test('SMTP requires verified TLS configuration and a public HTTPS URL', () => {
  const previous = {
    demo: env.DEMO_MODE,
    publicUrl: env.PUBLIC_WEB_URL,
    host: env.SAFEWALK_SMTP_HOST,
    user: env.SAFEWALK_SMTP_USER,
    password: env.SAFEWALK_SMTP_PASSWORD,
    from: env.SAFEWALK_SMTP_FROM,
    secure: env.SAFEWALK_SMTP_SECURE,
  };
  try {
    env.DEMO_MODE = 'false';
    env.PUBLIC_WEB_URL = 'http://localhost:8081';
    env.SAFEWALK_SMTP_HOST = 'smtp.example';
    env.SAFEWALK_SMTP_USER = 'user';
    env.SAFEWALK_SMTP_PASSWORD = 'password';
    env.SAFEWALK_SMTP_FROM = 'noreply@safewalk.example';
    env.SAFEWALK_SMTP_SECURE = 'true';
    assert.equal(smtpConfigFromEnvironment(), null);

    env.PUBLIC_WEB_URL = 'https://safewalk.example';
    env.SAFEWALK_SMTP_SECURE = 'false';
    assert.equal(smtpConfigFromEnvironment(), null);

    env.SAFEWALK_SMTP_SECURE = 'true';
    env.SAFEWALK_SMTP_HOST = '';
    assert.equal(smtpConfigFromEnvironment(), null);

    env.SAFEWALK_SMTP_HOST = 'smtp.example';
    assert.deepEqual(smtpConfigFromEnvironment(), {
      host: 'smtp.example',
      port: 465,
      username: 'user',
      password: 'password',
      from: 'noreply@safewalk.example',
    });
  } finally {
    env.DEMO_MODE = previous.demo;
    env.PUBLIC_WEB_URL = previous.publicUrl;
    env.SAFEWALK_SMTP_HOST = previous.host;
    env.SAFEWALK_SMTP_USER = previous.user;
    env.SAFEWALK_SMTP_PASSWORD = previous.password;
    env.SAFEWALK_SMTP_FROM = previous.from;
    env.SAFEWALK_SMTP_SECURE = previous.secure;
  }
});
