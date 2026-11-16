import { randomUUID, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import type { Session, ProfileSettings, ProfileSettingsInput } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { hashSecret, verifySecret } from '../../domain/security.js';
import { settingsChangeNeedsPin } from '../../domain/settings-protection.js';
import { AppError } from '../../middleware/errors.js';
import * as users from './auth.repository.js';
import { createContact } from '../contacts/contacts.repository.js';
import { requestOwnedAccountDeletion } from './account.repository.js';
import { getSettings, updateSettings } from './settings.repository.js';
import { exportOwnedRecords, pruneExpiredHistory } from './privacy.repository.js';
import { clearPinFailures, reservePinAttempt } from './pin-lockout.repository.js';

async function sessionFor(row: users.UserRow): Promise<Session> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.id)
    .setIssuedAt()
    .setIssuer('safewalk-api')
    .setAudience('safewalk-client')
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  return { token, user: users.toUser(row) };
}
export async function register(name: string, email: string, password: string): Promise<Session> {
  try {
    return await sessionFor(await users.insertUser(name, email, await hashSecret(password)));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    )
      throw new AppError(409, 'EMAIL_EXISTS', 'Este e-mail já está cadastrado.');
    throw error;
  }
}
export async function login(email: string, password: string): Promise<Session> {
  const row = await users.findUserByEmail(email);
  if (!row || !(await verifySecret(password, row.password_hash)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
  return sessionFor(row);
}
export async function demoSession(): Promise<Session> {
  if (env.DEMO_MODE !== 'true') throw new AppError(404, 'NOT_FOUND', 'Recurso indisponível.');
  const row = await users.insertUser(
    'Leo',
    `demo-${randomUUID()}@safewalk.local`,
    await hashSecret(randomBytes(32).toString('hex')),
    await hashSecret('1234'),
    true,
  );
  await Promise.all([
    createContact(
      row.id,
      {
        name: 'Mãe',
        phone: '+5511900000001',
        relationship: 'Família',
        emailTripAlerts: false,
      },
      true,
    ),
    createContact(
      row.id,
      {
        name: 'Ana',
        phone: '+5511900000002',
        relationship: 'Amiga',
        emailTripAlerts: false,
      },
      true,
    ),
  ]);
  return sessionFor(row);
}
/** Confere o PIN reservando uma tentativa; erros repetidos bloqueiam novas tentativas no banco. */
async function checkPinWithLockout<T>(
  userId: string,
  check: () => Promise<T | null>,
): Promise<T | null> {
  await reservePinAttempt(userId);
  const result = await check();
  if (result !== null) await clearPinFailures(userId);
  return result;
}
async function matchesPrimaryPin(userId: string, row: users.UserRow, pin: string) {
  const pinHash = row.pin_hash;
  if (!pinHash) return false;
  return Boolean(
    await checkPinWithLockout(userId, async () =>
      (await verifySecret(pin, pinHash)) ? true : null,
    ),
  );
}
export async function requirePin(userId: string, pin: string): Promise<void> {
  const row = await users.findUserById(userId);
  if (!row?.pin_hash || !(await matchesPrimaryPin(userId, row, pin)))
    throw new AppError(403, 'INVALID_PIN', 'PIN incorreto. Confira e tente novamente.');
}
export async function verifyTripPin(userId: string, pin: string): Promise<'primary' | 'duress'> {
  const row = await users.findUserById(userId);
  const kind = row
    ? await checkPinWithLockout<'primary' | 'duress'>(userId, async () => {
        if (row.pin_hash && (await verifySecret(pin, row.pin_hash))) return 'primary';
        if (row.duress_pin_hash && (await verifySecret(pin, row.duress_pin_hash))) return 'duress';
        return null;
      })
    : null;
  if (!kind) throw new AppError(403, 'INVALID_PIN', 'PIN incorreto. Confira e tente novamente.');
  return kind;
}
export async function setDuressPin(
  userId: string,
  currentPin: string,
  duressPin: string,
): Promise<void> {
  const row = await users.findUserById(userId);
  if (!row?.pin_hash || !(await matchesPrimaryPin(userId, row, currentPin)))
    throw new AppError(403, 'INVALID_PIN', 'PIN incorreto. Confira e tente novamente.');
  if (await verifySecret(duressPin, row.pin_hash))
    throw new AppError(
      409,
      'DURESS_PIN_SAME',
      'O PIN de coação precisa ser diferente do PIN principal.',
    );
  await users.setUserDuressPin(userId, await hashSecret(duressPin));
}
export async function removeDuressPin(userId: string, currentPin: string): Promise<void> {
  await requirePin(userId, currentPin);
  await users.setUserDuressPin(userId, null);
}
export async function configurePin(userId: string, pin: string): Promise<void> {
  const row = await users.findUserById(userId);
  if (row?.pin_hash)
    throw new AppError(
      409,
      'PIN_ALREADY_SET',
      'O PIN já foi configurado. A alteração exige confirmar o PIN atual.',
    );
  await users.setUserPin(userId, await hashSecret(pin));
}

export async function verifyAccountCredential(
  userId: string,
  credential: { currentPin?: string; password?: string },
): Promise<users.UserRow> {
  const row = await users.findUserById(userId);
  if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Entre novamente para continuar.');
  const valid = row.pin_hash
    ? Boolean(
        credential.currentPin && (await matchesPrimaryPin(userId, row, credential.currentPin)),
      )
    : Boolean(credential.password && (await verifySecret(credential.password, row.password_hash)));
  if (!valid)
    throw new AppError(
      403,
      'INVALID_CREDENTIAL',
      row.pin_hash
        ? 'PIN incorreto. Confira e tente novamente.'
        : 'Senha incorreta. Confira e tente novamente.',
    );
  return row;
}

export async function changePin(userId: string, currentPin: string, newPin: string): Promise<void> {
  await requirePin(userId, currentPin);
  const row = await users.findUserById(userId);
  if (row?.duress_pin_hash && (await verifySecret(newPin, row.duress_pin_hash)))
    throw new AppError(
      409,
      'PIN_MATCHES_DURESS',
      'O novo PIN precisa ser diferente do PIN de coação.',
    );
  await users.setUserPin(userId, await hashSecret(newPin));
}

export async function updateProfile(
  userId: string,
  input: { name: string; email: string; phone: string; currentPin?: string; password?: string },
) {
  await verifyAccountCredential(userId, input);
  try {
    const row = await users.updateUserProfile(userId, input);
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Entre novamente.');
    return { ...users.toUser(row), phone: row.phone };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    )
      throw new AppError(409, 'EMAIL_EXISTS', 'Este e-mail já está cadastrado.');
    throw error;
  }
}

export async function deleteAccount(
  userId: string,
  credential: { pin?: string; password?: string },
): Promise<void> {
  await verifyAccountCredential(userId, {
    currentPin: credential.pin,
    password: credential.password,
  });
  await requestOwnedAccountDeletion(userId);
}

export async function saveSettings(
  userId: string,
  input: ProfileSettingsInput,
): Promise<ProfileSettings> {
  const { currentPin, ...next } = input;
  if (settingsChangeNeedsPin(await getSettings(userId), next)) {
    const row = await users.findUserById(userId);
    // Sem PIN cadastrado não há como provar a titularidade: reduzir proteção é negado.
    if (!row?.pin_hash)
      throw new AppError(
        403,
        'PIN_SETUP_REQUIRED_FOR_SETTINGS',
        'Crie um PIN de cancelamento antes de reduzir proteções da conta.',
      );
    if (!currentPin)
      throw new AppError(
        403,
        'PIN_REQUIRED_FOR_SETTINGS',
        'Digite seu PIN para reduzir proteções ou o prazo de histórico.',
      );
    await requirePin(userId, currentPin);
  }
  const result = await updateSettings(userId, next);
  await pruneExpiredHistory(userId);
  return result;
}

export async function exportAccount(userId: string) {
  const row = await users.findUserById(userId);
  if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Entre novamente.');
  return {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    profile: { ...users.toUser(row), phone: row.phone },
    settings: await getSettings(userId),
    data: await exportOwnedRecords(userId),
  };
}
