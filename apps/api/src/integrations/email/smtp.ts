import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { connect, type TLSSocket } from 'node:tls';
import { env } from '../../config/env.js';

export interface SafeWalkEmail {
  to: string;
  subject: string;
  text: string;
  /** Versão HTML opcional; o texto puro continua indo junto (multipart/alternative). */
  html?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

function validAddress(value: string): boolean {
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}

/**
 * Um link só entra em e-mail se for https. A exceção é o desenvolvimento local com
 * SAFEWALK_SMTP_ALLOW_LOCAL_LINKS=true, que aceita http em localhost para testar o envio de ponta a ponta.
 */
export function emailLinkAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return (
      url.protocol === 'http:' &&
      env.NODE_ENV !== 'production' &&
      env.SAFEWALK_SMTP_ALLOW_LOCAL_LINKS === 'true' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export function smtpConfigFromEnvironment(): SmtpConfig | null {
  if (env.DEMO_MODE === 'true' || !emailLinkAllowed(env.PUBLIC_WEB_URL)) return null;

  const host = env.SAFEWALK_SMTP_HOST.trim();
  const username = env.SAFEWALK_SMTP_USER;
  const password = env.SAFEWALK_SMTP_PASSWORD;
  const from = env.SAFEWALK_SMTP_FROM.trim().toLowerCase();
  const port = env.SAFEWALK_SMTP_PORT;

  if (
    !host ||
    !username ||
    !password ||
    !from ||
    !validAddress(from) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    env.SAFEWALK_SMTP_SECURE !== 'true'
  )
    return null;

  return { host, port, username, password, from };
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeBody(value: string): string {
  const base64 = Buffer.from(value.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64');
  return base64.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function part(contentType: string, value: string): string {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(value),
  ].join('\r\n');
}

export function dataBlock(message: SafeWalkEmail, from: string): string {
  const headers = [
    `From: SafeWalk <${from}>`,
    `To: <${message.to}>`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@safewalk>`,
    'MIME-Version: 1.0',
  ];
  if (!message.html)
    return `${headers.join('\r\n')}\r\n${part('text/plain', message.text)}\r\n.\r\n`;
  const boundary = `safewalk-${randomUUID()}`;
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    part('text/plain', message.text),
    `--${boundary}`,
    part('text/html', message.html),
    `--${boundary}--`,
    '.',
    '',
  ].join('\r\n');
}

function openTlsSocket(config: SmtpConfig): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: config.host,
      port: config.port,
      servername: config.host,
      rejectUnauthorized: true,
    });
    // O relay pode demorar a confirmar a primeira mensagem (filtros do provedor): 25 s de tolerância.
    socket.setTimeout(25000, () => socket.destroy(new Error('SMTP timeout')));
    const onError = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.once('error', onError);
    socket.once('secureConnect', () => {
      socket.removeListener('error', onError);
      resolve(socket);
    });
  });
}

async function readReply(iterator: AsyncIterator<string>): Promise<{ code: number; text: string }> {
  const lines: string[] = [];
  let code: number | undefined;
  while (true) {
    const next = await iterator.next();
    if (next.done) throw new Error('SMTP connection closed before reply');
    const line = next.value;
    const match = /^(\d{3})([ -])/.exec(line);
    if (!match) throw new Error('Invalid SMTP reply');
    const lineCode = Number(match[1]);
    if (code !== undefined && code !== lineCode) throw new Error('Inconsistent SMTP reply');
    code = lineCode;
    lines.push(line);
    if (match[2] === ' ') return { code, text: lines.join('\n') };
  }
}

async function expectReply(
  iterator: AsyncIterator<string>,
  accepted: readonly number[],
): Promise<{ code: number; text: string }> {
  const reply = await readReply(iterator);
  if (!accepted.includes(reply.code)) throw new Error(`SMTP rejected command (${reply.code})`);
  return reply;
}

async function command(
  socket: TLSSocket,
  iterator: AsyncIterator<string>,
  value: string,
  accepted: readonly number[],
): Promise<{ code: number; text: string }> {
  socket.write(`${value}\r\n`);
  return expectReply(iterator, accepted);
}

export async function sendSafeWalkEmail(message: SafeWalkEmail): Promise<void> {
  const config = smtpConfigFromEnvironment();
  if (!config) throw new Error('SMTP is not configured for real email delivery');
  if (!validAddress(message.to)) throw new Error('Invalid recipient address');
  if (/[\r\n]/.test(message.subject)) throw new Error('Invalid email subject');

  const socket = await openTlsSocket(config);
  const reader = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = reader[Symbol.asyncIterator]();
  try {
    await expectReply(iterator, [220]);
    await command(socket, iterator, 'EHLO safewalk.local', [250]);
    await command(socket, iterator, 'AUTH LOGIN', [334]);
    await command(socket, iterator, Buffer.from(config.username).toString('base64'), [334]);
    await command(socket, iterator, Buffer.from(config.password).toString('base64'), [235]);
    await command(socket, iterator, `MAIL FROM:<${config.from}>`, [250]);
    await command(socket, iterator, `RCPT TO:<${message.to}>`, [250, 251]);
    await command(socket, iterator, 'DATA', [354]);
    socket.write(dataBlock(message, config.from));
    await expectReply(iterator, [250]);
    try {
      await command(socket, iterator, 'QUIT', [221]);
    } catch {
      // The relay already accepted the message after the final DATA response.
    }
  } finally {
    reader.close();
    socket.destroy();
  }
}
