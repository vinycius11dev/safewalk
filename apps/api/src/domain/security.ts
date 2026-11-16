import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(secret, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = (await derive(secret, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const hashShareToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const createShareToken = (): string => randomBytes(32).toString('base64url');
