#!/usr/bin/env bash
# Turnstile end-to-end: cria widget (se token API) ou grava chaves + valida secret.
#
# Pré-requisitos para criar widget automaticamente:
#   export CLOUDFLARE_API_TOKEN=<token com Account.Turnstile:Edit>
#   export CLOUDFLARE_ACCOUNT_ID=<account id do painel Cloudflare>
#
# Uso:
#   ./scripts/setup-turnstile-e2e.sh
#   ./scripts/setup-turnstile-e2e.sh --domains eventosbr.app.br,www.eventosbr.app.br

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
DOMAIN="${DOMAIN:-eventosbr.app.br}"
# Produção: só apex + www (localhost opcional para dev — ver README turnstile-spin)
DOMAINS="${DOMAIN},www.${DOMAIN}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --domains) DOMAINS="$2"; shift 2 ;;
    *) echo "unknown $1" >&2; exit 2 ;;
  esac
done

echo "==> Turnstile E2E — domínios (normalizados na criação): $DOMAINS"
echo "    (um hostname por entrada no painel; CSV sem espaços no script)"

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "==> Criando widget via API Cloudflare..."
  out=$(./scripts/turnstile-spin/widget-create.sh \
    --account-id "$CLOUDFLARE_ACCOUNT_ID" \
    --name "EventosBR (Spin)" \
    --domains "$DOMAINS" \
    --mode managed)
  sitekey=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["sitekey"])' "$out")
  secret=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["secret"])' "$out")
  set_env_var "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "$sitekey" "$ENV_FILE"
  set_env_var "TURNSTILE_SECRET_KEY" "$secret" "$ENV_FILE"
  echo "    Site Key: $sitekey"
else
  echo "==> Sem CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID — use o painel ou:"
  echo "    ./scripts/configure-turnstile-env.sh"
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

secret=$(env_get TURNSTILE_SECRET_KEY "$ENV_FILE" || true)
sitekey=$(env_get NEXT_PUBLIC_TURNSTILE_SITE_KEY "$ENV_FILE" || true)
if [ -z "$secret" ] || [ -z "$sitekey" ]; then
  echo "ERRO: TURNSTILE_SECRET_KEY e NEXT_PUBLIC_TURNSTILE_SITE_KEY precisam estar no $ENV_FILE" >&2
  exit 1
fi

echo "==> Validando secret (dummy siteverify)..."
export TURNSTILE_SECRET_KEY="$secret"
./scripts/turnstile-spin/validate.sh

echo ""
echo "==> Próximo passo (produção Docker):"
echo "    docker compose -f docker-compose.prod.yml up -d --build web"
echo "    docker compose -f docker-compose.prod.yml up -d api"
echo "    bash scripts/validar-go-live-vps.sh"
