import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prepara, só localmente, o que vai para a hospedagem (CloudLinux/Passenger da ValueHost).
 * Rode depois dos builds (ver docs/valuehost.md). Nenhum segredo nem `.env` entra no pacote.
 *
 * Saída em work/valuehost-<data>/:
 *   safewalk-backend.tar.gz  -> extrair em ~/safewalk (apps/api + database/migrations)
 *   safewalk-web.tar.gz      -> extrair no public_html do app web
 *   safewalk-painel.tar.gz   -> extrair no public_html do painel da Prefeitura
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
// No GitHub Actions a saída vai para uma pasta fixa (VALUEHOST_OUT), publicada na branch `release`.
const destination = process.env.VALUEHOST_OUT
  ? resolve(process.env.VALUEHOST_OUT)
  : join(root, 'work', `valuehost-${stamp}`);
const backend = join(destination, 'backend');
const api = join(backend, 'apps', 'api');
/** Pasta da API no servidor (conta `safewalk` da ValueHost por padrão). */
const serverApiDir = (
  process.env.SAFEWALK_SERVER_API_DIR ?? '/home/safewalk/safewalk/apps/api'
).replace(/\/+$/, '');
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

await rm(destination, { recursive: true, force: true });
await mkdir(join(api, 'vendor'), { recursive: true });

// API: código compilado, entrada do Passenger e contratos embutidos como pacote .tgz. O nodevenv do
// CloudLinux guarda node_modules fora da pasta do app, então link de workspace não funcionaria.
await cp(join(root, 'apps/api/dist'), join(api, 'dist'), { recursive: true });
await cp(join(root, 'apps/api/app.cjs'), join(api, 'app.cjs'));
await cp(join(root, 'apps/api/.env.example'), join(api, '.env.example'));
await cp(
  join(root, 'apps/api/scripts/import-urban-data.mjs'),
  join(api, 'scripts/import-urban-data.mjs'),
);
run('npm', ['pack', '--pack-destination', join(api, 'vendor')], join(root, 'packages/contracts'));
const [packed] = (await readdir(join(api, 'vendor'))).filter((name) => name.endsWith('.tgz'));
if (!packed) throw new Error('npm pack não gerou o pacote dos contratos.');
// O hash do conteúdo vai no nome: com nome e versão iguais, o npm do servidor reaproveitaria o
// pacote antigo do cache e a API subiria com contratos desatualizados.
const packedBytes = await readFile(join(api, 'vendor', packed));
const digest = createHash('sha256').update(packedBytes).digest('hex').slice(0, 12);
const tarball = packed.replace(/\.tgz$/, `-${digest}.tgz`);
await rename(join(api, 'vendor', packed), join(api, 'vendor', tarball));
const manifest = JSON.parse(await readFile(join(root, 'apps/api/package.json'), 'utf8'));
await writeFile(
  join(api, 'package.json'),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      private: true,
      type: 'module',
      engines: { node: '>=22.13.0' },
      scripts: {
        start: 'node app.cjs',
        migrate: 'node dist/database/migrate.js',
        'import:urban': 'node scripts/import-urban-data.mjs',
        'admin:create': 'node dist/modules/admin/create-admin.js',
      },
      // Caminho absoluto: o npm do nodevenv resolve `file:` relativo à pasta do nodevenv, não à do app.
      dependencies: {
        ...manifest.dependencies,
        '@safewalk/contracts': `file:${serverApiDir}/vendor/${tarball}`,
      },
    },
    null,
    2,
  )}\n`,
);
// dist/database/migrate.js procura ../../../../database/migrations: ~/safewalk/database/migrations.
await cp(join(root, 'database/migrations'), join(backend, 'database/migrations'), {
  recursive: true,
});

const spa = (extra = '') =>
  `Options -Indexes\nDirectoryIndex index.html\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTPS} !=on\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [L]\n</IfModule>\n<IfModule mod_headers.c>\nHeader set Referrer-Policy "no-referrer"\nHeader set X-Content-Type-Options "nosniff"\n${extra}<FilesMatch "\\.html$">\nHeader set Cache-Control "no-cache"\n</FilesMatch>\n<FilesMatch "\\.(js|css|woff2?|png|jpg|svg|mp4)$">\nHeader set Cache-Control "public, max-age=604800"\n</FilesMatch>\n</IfModule>\n`;
await cp(join(root, 'apps/mobile/dist'), join(destination, 'web'), { recursive: true });
await writeFile(join(destination, 'web/.htaccess'), spa());
await cp(join(root, 'apps/admin/dist'), join(destination, 'painel'), { recursive: true });
await writeFile(
  join(destination, 'painel/.htaccess'),
  spa('Header set X-Robots-Tag "noindex, nofollow"\nHeader set X-Frame-Options "DENY"\n'),
);

for (const [name, folder] of [
  ['safewalk-backend.tar.gz', 'backend'],
  ['safewalk-web.tar.gz', 'web'],
  ['safewalk-painel.tar.gz', 'painel'],
])
  run('tar', ['-czf', name, '-C', folder, '.'], destination);

// Formato do `sha256sum -c`: o servidor confere os pacotes antes de trocar a versão no ar.
const sums = [];
for (const name of ['safewalk-backend.tar.gz', 'safewalk-web.tar.gz', 'safewalk-painel.tar.gz']) {
  const digestHex = createHash('sha256')
    .update(await readFile(join(destination, name)))
    .digest('hex');
  sums.push(`${digestHex}  ${name}`);
}
await writeFile(join(destination, 'SHA256SUMS'), `${sums.join('\n')}\n`);

await writeFile(
  join(destination, 'LEIA-ME.txt'),
  'Pacote local. Nenhum arquivo foi publicado e nenhum segredo foi copiado.\n' +
    'Backend: extrair em ~/safewalk; app Node com raiz safewalk/apps/api e arquivo inicial app.cjs.\n' +
    'Configure apps/api/.env no servidor (veja .env.example). Depois: npm install --omit=dev, npm run migrate.\n' +
    'Web e painel: extrair cada um no public_html do subdomínio correspondente.\n',
);
console.info(`Pacote local preparado em ${destination}.`);
