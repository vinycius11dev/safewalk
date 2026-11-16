import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';

/**
 * Remove o que o teste de integração do painel deixa no banco local: os relatos sintéticos e as
 * contas de operador de teste. Roda só com DEMO_MODE=true fora de produção.
 */
export const TEST_REPORT_ADDRESS = 'Rua Sintética do Painel, 100 · Teste';
export const TEST_ADMIN_EMAIL_PATTERN = 'teste-%@painel.local';

try {
  if (env.NODE_ENV === 'production' || env.DEMO_MODE !== 'true')
    throw new Error('A limpeza de teste só roda com DEMO_MODE=true fora de produção.');
  const [reports] = await pool.execute('DELETE FROM reports WHERE address = ?', [
    TEST_REPORT_ADDRESS,
  ]);
  await pool.execute(
    "DELETE FROM password_reset_tokens WHERE account_kind = 'admin' AND account_id IN (SELECT id FROM admin_users WHERE email LIKE ?)",
    [TEST_ADMIN_EMAIL_PATTERN],
  );
  const [admins] = await pool.execute('DELETE FROM admin_users WHERE email LIKE ?', [
    TEST_ADMIN_EMAIL_PATTERN,
  ]);
  const count = (result: unknown) =>
    typeof result === 'object' && result !== null && 'affectedRows' in result
      ? Number(result.affectedRows)
      : 0;
  console.info(
    `Limpeza de teste: ${count(reports)} relatos e ${count(admins)} operadores removidos.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível limpar os testes.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
