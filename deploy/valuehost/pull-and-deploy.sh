#!/bin/bash
# Implanta no servidor a última versão publicada na branch `release` do GitHub.
# Roda pelo cron da conta `safewalk` (a cada 5 minutos). O servidor só LÊ o repositório, com uma
# chave de implantação somente leitura: nenhuma credencial do servidor fica no GitHub.
#
# Instalação (uma vez): ver docs/valuehost.md, seção "Publicação automática".
set -euo pipefail

BASE="${SAFEWALK_DEPLOY_DIR:-$HOME/safewalk-deploy}"
# shellcheck source=/dev/null
source "$BASE/config" # REPO=ssh://git@ssh.github.com:443/<dono>/<repositorio>.git
APP="$HOME/safewalk"
API="$APP/apps/api"
WEB="$HOME/domains/safewalk.recapture.com.br/public_html"
PAINEL="$HOME/domains/painel.safewalk.recapture.com.br/public_html"
NODEVENV="$HOME/nodevenv/safewalk/apps/api/22/bin/activate"
HEALTH_URL="https://api.safewalk.recapture.com.br/health"
SRC="$BASE/release"

log() { echo "$(date '+%F %T') $*"; }

# Uma execução por vez (o cron pode disparar enquanto a anterior ainda instala).
exec 9>"$BASE/.lock"
flock -n 9 || exit 0

export GIT_SSH_COMMAND="ssh -i $BASE/deploy_key -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$BASE/known_hosts"
if [ ! -d "$SRC/.git" ]; then
  git clone -q --depth 1 --branch release "$REPO" "$SRC"
else
  git -C "$SRC" fetch -q --depth 1 origin release
  git -C "$SRC" reset -q --hard FETCH_HEAD
fi

NEW="$(git -C "$SRC" rev-parse HEAD)"
[ "$NEW" = "$(cat "$BASE/deployed" 2>/dev/null || true)" ] && exit 0
# Uma versão que já falhou não é tentada de novo a cada 5 minutos; a próxima publicação substitui.
[ "$NEW" = "$(cat "$BASE/failed" 2>/dev/null || true)" ] && exit 0

SWAPPED=0
fail() {
  if [ "$SWAPPED" = 1 ]; then
    log "FALHA na versão ${NEW:0:7}: $1. Os arquivos novos já foram copiados: confira o log e a API."
  else
    log "FALHA na versão ${NEW:0:7}: $1. Nada foi trocado; a versão anterior continua no ar."
  fi
  echo "$NEW" >"$BASE/failed"
  exit 1
}

log "Nova versão: $(grep '^commit=' "$SRC/VERSION" | cut -c8-14) (pacote ${NEW:0:7})"
(cd "$SRC" && sha256sum -c --quiet SHA256SUMS) || fail "hash dos pacotes não confere"

STAGE="$(mktemp -d "$BASE/stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/backend" "$STAGE/web" "$STAGE/painel"
tar -xzf "$SRC/safewalk-backend.tar.gz" -C "$STAGE/backend" || fail "pacote da API inválido"
tar -xzf "$SRC/safewalk-web.tar.gz" -C "$STAGE/web" || fail "pacote do app inválido"
tar -xzf "$SRC/safewalk-painel.tar.gz" -C "$STAGE/painel" || fail "pacote do painel inválido"

# API: troca o código compilado; .env, fotos e node_modules ficam como estão.
SWAPPED=1
rm -rf "$API/dist"
cp -a "$STAGE/backend/." "$APP/"
set +u
# shellcheck source=/dev/null
source "$NODEVENV"
set -u
cd "$API"
npm install --omit=dev --no-audit --no-fund --loglevel=error || fail "npm install"
npm run --silent migrate || fail "migração do banco"
mkdir -p tmp && touch tmp/restart.txt

# Web e painel: os arquivos com hash no nome são trocados inteiros.
rm -rf "$WEB/_expo" "$PAINEL/assets"
cp -a "$STAGE/web/." "$WEB/"
cp -a "$STAGE/painel/." "$PAINEL/"

sleep 6
if curl -fsS --max-time 20 "$HEALTH_URL" >/dev/null; then
  echo "$NEW" >"$BASE/deployed"
  rm -f "$BASE/failed"
  log "Versão no ar e API respondendo."
else
  fail "a API não respondeu depois do reinício"
fi
