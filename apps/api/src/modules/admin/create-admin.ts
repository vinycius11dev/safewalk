import { randomBytes } from 'node:crypto';
import {
  ADMIN_PASSWORD_MIN_LENGTH as MIN_PASSWORD_LENGTH,
  adminRoleSchema,
  emailSchema,
} from '@safewalk/contracts';
import { pool } from '../../database/pool.js';
import { hashSecret } from '../../domain/security.js';
import { insertAdmin } from './admin-accounts.repository.js';

/**
 * Cria uma conta de operador do painel. Uso:
 *   ADMIN_PASSWORD='...' npm run admin:create -w @safewalk/api -- email@dominio.gov.br "Nome" operator
 * Sem ADMIN_PASSWORD o script gera uma senha forte e a mostra uma única vez neste terminal.
 */
const [emailArg, nameArg, roleArg = 'operator'] = process.argv.slice(2);
try {
  const email = emailSchema.parse(emailArg);
  const name = (nameArg ?? '').trim();
  const role = adminRoleSchema.parse(roleArg);
  if (name.length < 2) throw new Error('Informe o nome do operador.');
  const provided = process.env.ADMIN_PASSWORD;
  if (provided !== undefined && provided.length < MIN_PASSWORD_LENGTH)
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  const password = provided ?? randomBytes(18).toString('base64url');
  await insertAdmin(email, name, await hashSecret(password), role);
  console.info(`Operador criado: ${email} (${role}).`);
  if (provided === undefined)
    console.info(`Senha gerada (guarde agora, não será mostrada de novo): ${password}`);
} catch (error) {
  console.error(
    error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY'
      ? 'Já existe um operador com este e-mail.'
      : error instanceof Error
        ? error.message
        : 'Não foi possível criar o operador.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
