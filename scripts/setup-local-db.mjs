import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../apps/api/.env', import.meta.url));
try {
  await readFile(envFile);
  console.info('O .env já existe. Para preservar credenciais, execute npm run db:migrate.');
  process.exit(0);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const executable =
  process.env.SAFEWALK_MARIADB_CLI ?? 'C:\\wamp64\\bin\\mariadb\\mariadb11.5.2\\bin\\mariadb.exe';
const password = randomBytes(32).toString('hex');
const jwtSecret = randomBytes(48).toString('hex');
const sql = `CREATE DATABASE IF NOT EXISTS safewalk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'safewalk_app'@'localhost' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON safewalk.* TO 'safewalk_app'@'localhost';`;
const result = spawnSync(
  executable,
  ['--host=127.0.0.1', '--port=3307', '--user=root', '--skip-password', '--connect-timeout=3'],
  { input: sql, encoding: 'utf8', windowsHide: true },
);
if (result.status !== 0)
  throw new Error(
    'Não foi possível configurar o banco local. Confira a conexão de administrador; nenhum .env foi gravado.',
  );
const configuration = `NODE_ENV=development\nPORT=4010\nHOST=0.0.0.0\nDB_HOST=127.0.0.1\nDB_PORT=3307\nDB_NAME=safewalk\nDB_USER=safewalk_app\nDB_PASSWORD=${password}\nJWT_SECRET=${jwtSecret}\nWEB_ORIGINS=http://localhost:8081,http://127.0.0.1:8081\nPUBLIC_WEB_URL=http://localhost:8081\nDEMO_MODE=true\nALERT_WORKER_ENABLED=true\n`;
await writeFile(envFile, configuration, { flag: 'wx' });
console.info(
  'Banco local e usuário restrito configurados. Credenciais gravadas somente em apps/api/.env.',
);
