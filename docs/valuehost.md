# Publicação na ValueHost

Plano: Revenda Turbo NVMe Standard Brasil, DirectAdmin, Node 22.23.4 (CloudLinux + Passenger) e MariaDB 10.11. Cada usuário DirectAdmin tem limite próprio de ~100 processos/threads; por isso o SafeWalk fica numa conta separada, sem disputar com os outros projetos da revenda.

## Publicação atual (15/11/2026)

| Item                 | Onde                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Conta DirectAdmin    | usuário `safewalk` (pacote `safewalk`, criado pela revenda)                                                             |
| App web              | https://safewalk.recapture.com.br → `~/domains/safewalk.recapture.com.br/public_html`                                   |
| Painel da Prefeitura | https://painel.safewalk.recapture.com.br → `~/domains/painel.safewalk.recapture.com.br/public_html`                     |
| API                  | https://api.safewalk.recapture.com.br → app Node com raiz `safewalk/apps/api`, arquivo inicial `app.cjs`, modo produção |
| Banco                | `safewalk_safe` (usuário de mesmo nome, só `localhost`), migrações 001–024 e dados urbanos importados                   |
| Fotos dos relatos    | `~/safewalk/storage/report-photos`                                                                                      |
| Keep-alive           | cron a cada 5 min em `/health`, para o Passenger não desligar o worker de alertas                                       |

O `.env` fica em `~/safewalk/apps/api/.env` (chmod 600), nunca no pacote. Valores que começam com `#` precisam de aspas (`DB_PASSWORD='...'`), senão o dotenv lê como comentário.

Recuperação de senha (migração 024): o `.env` precisa de `ADMIN_PANEL_URL=https://painel.safewalk.recapture.com.br` e das variáveis `SAFEWALK_SMTP_*` (porta 465, `SAFEWALK_SMTP_SECURE=true`). Sem SMTP, "Esqueci minha senha" responde normalmente mas nenhum e-mail sai.

### Publicação automática (GitHub → servidor)

1. Toda mudança que entra na `main` dispara o workflow `.github/workflows/release.yml`: `npm ci`, tipos, lint e testes. Se passar, ele monta os pacotes (API, app web e painel, com `SAFEWALK_API_URL` das variáveis do repositório ou o endereço atual) e publica na branch `release`, com `SHA256SUMS` e `VERSION`. Pull Requests só rodam a verificação.
2. No servidor, o cron da conta `safewalk` roda `~/safewalk-deploy/pull-and-deploy.sh` a cada 5 minutos. Ele busca a branch `release` com uma chave de implantação **somente leitura** (`~/safewalk-deploy/deploy_key`), confere os hashes, extrai tudo numa pasta temporária e só então troca a API (preservando `.env`, fotos e `node_modules`), roda `npm install`, `npm run migrate`, reinicia o Passenger, troca web e painel e confere `/health`.
3. Registro em `~/safewalk-deploy/deploy.log`; versão no ar em `~/safewalk-deploy/deployed`. Uma versão que falha fica em `failed` e não é tentada de novo até a próxima publicação.

Nenhuma senha, chave ou acesso do servidor fica no GitHub: colaboradores só mexem no código. Repositório: `vinycius11dev/safewalk` (privado). A proteção da `main` (exigir Pull Request aprovado e verificação verde) depende do GitHub Pro em repositório privado; sem ela, quem tem acesso de escrita consegue enviar direto para a `main`, mas a publicação continua bloqueada se tipos, lint ou testes falharem. Instalação no servidor (já feita): copiar `deploy/valuehost/pull-and-deploy.sh` e `config.example` (como `config`, com o endereço do repositório) para `~/safewalk-deploy`, gerar `deploy_key` com `ssh-keygen -t ed25519 -N ''`, cadastrar a parte `.pub` como *Deploy key* (somente leitura) no repositório, gravar a chave do host com `ssh-keyscan -p 443 ssh.github.com > known_hosts` e adicionar ao cron `*/5 * * * * ~/safewalk-deploy/pull-and-deploy.sh >> ~/safewalk-deploy/deploy.log 2>&1`.

### Atualizar uma versão manualmente

1. Local: builds (`npm run build`, web com `EXPO_PUBLIC_API_URL=https://api.safewalk.recapture.com.br`, painel com `VITE_API_URL` igual) e `npm run package:valuehost`.
2. Servidor: extrair `safewalk-backend.tar.gz` em `~/safewalk` (preserva o `.env`), web e painel nos `public_html`.
3. No terminal da conta: `source ~/nodevenv/safewalk/apps/api/22/bin/activate && cd ~/safewalk/apps/api && npm install --omit=dev && npm run migrate`, depois `touch tmp/restart.txt`.
4. Dados urbanos: `node scripts/export-urban-data.mjs` local e `npm run import:urban -- <arquivo>` no servidor (substitui só as importações de mesmo id). O arquivo leva também os boletins da SSP (`crime_points`) e os municípios do Infosiga; para mandar só essas duas bases, use `node scripts/export-urban-data.mjs work/safewalk-dados-ssp-infosiga.ndjson.gz --sources ssp-crimes,infosiga`. Para SSP e Infosiga a importação no servidor apaga o lote anterior da mesma fonte, como os importadores originais. Assim o servidor não precisa de Python nem das planilhas.
5. Operadores do painel: `npm run admin:create -- <email> "<nome>" operator`, digitado pelo próprio operador no terminal do servidor.

O `.tgz` dos contratos leva o hash do conteúdo no nome; sem isso o npm do servidor reaproveita a versão antiga do cache (mesmo nome e versão) e a API não sobe. O pacote referencia os contratos por caminho absoluto (`SAFEWALK_SERVER_API_DIR`, padrão `/home/safewalk/safewalk/apps/api`), porque o npm do nodevenv resolve `file:` relativo à pasta do nodevenv.

`npm run package:valuehost` só prepara arquivos localmente em `work/valuehost-<data>`; não envia nada à hospedagem.

## Organização recomendada

- Aplicação Node fora de `public_html`.
- Código web exportado (`apps/mobile/dist`) em domínio/subdomínio dedicado, com fallback de SPA para `index.html`.
- API em subdomínio próprio; banco e usuário criados pelo DirectAdmin e com permissões restritas.
- Manter o pacote `@safewalk/contracts` compilado e disponível à API. O monorepo precisa manter `apps/api`, `packages/contracts` e `database/migrations`, ou usar o pacote preparado pelo script de distribuição.
- Gerar builds no computador de desenvolvimento, evitando consumir os processos da hospedagem.
- Configurar `.env` somente no servidor, fora da raiz pública. Alterar `DB_PORT` para o serviço remoto (não copiar a porta 3307 do Wamp sem verificar).
- `PUBLIC_WEB_URL` deve ser a URL HTTPS real dos contatos; `WEB_ORIGINS` deve listar somente as origens da aplicação.
- Recompilar a web com `EXPO_PUBLIC_API_URL` da API remota.

## Painel da Prefeitura (demonstração)

O painel (`apps/admin`) entra no pacote como `safewalk-painel.tar.gz`. Requisitos: domínio ou subdomínio próprio (separado do app, para a sessão do painel não compartilhar origem com o cidadão), `npm run build -w @safewalk/admin` com `VITE_API_URL` da API remota, fallback de SPA para `index.html`, a origem do painel em `WEB_ORIGINS` da API e a migração 023 aplicada. Os operadores se criam no servidor com `npm run admin:create -w @safewalk/api` (senha de 12+ caracteres, só no terminal do servidor). `admin:seed` é só de demonstração e a API em produção já recusa `DEMO_MODE=true`. Antes de qualquer uso real, definir com a Prefeitura o canal, a base legal e o prazo de retenção dos relatos que chegam ao painel.

## Antes de publicar

1. Validar migrações em MariaDB 10.11 com banco separado de homologação.
2. Confirmar versão do Node, porta fornecida pelo Passenger e limites da conta.
3. Validar se o processo de prazos permanece ativo sem requisições. Cron comum não substitui um processador com intervalo de segundos.
4. Dimensionar conexões, retenção e notificações; implementar monitoramento e recuperação de falhas.
5. Testar HTTPS, CORS, autorização e expiração dos links com sessões já abertas.
6. Substituir os exemplos geográficos e serviços simulados conforme o escopo aprovado.

Fonte: https://www.valuehost.com.br/cliente/knowledgebase/85/Aplicacoes-Node.js-e-Python-na-hospedagem-configuracao-e-limites.html
