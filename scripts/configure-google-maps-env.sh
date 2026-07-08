#!/usr/bin/env bash
# Configura NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY no .env (mapa embutido na página do evento).
#
# Pré-requisito no Google Cloud Console:
#   1. Projeto com faturamento ativo (tier gratuito cobre uso típico)
#   2. Ativar "Maps Embed API"
#   3. Criar chave de API restrita por HTTP referrer:
#        https://eventosbr.app.br/*
#        https://www.eventosbr.app.br/*
#        http://localhost:3000/*   (opcional — dev local)
#
# Uso interativo:
#   ./scripts/configure-google-maps-env.sh
#
# Uso não interativo:
#   ./scripts/configure-google-maps-env.sh --embed-key 'AIza...'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE="$ROOT/.env.production.example"
EMBED_KEY=""

usage() {
  echo "Uso: $0 [--embed-key KEY]"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --embed-key) EMBED_KEY="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

if [ -z "$EMBED_KEY" ]; then
  echo ""
  echo "Google Maps Embed API — chave para mapa na página do evento"
  echo "Console: https://console.cloud.google.com/google/maps-apis/credentials"
  echo ""
  read -r -p "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY (AIza...): " EMBED_KEY
fi

EMBED_KEY="$(printf '%s' "$EMBED_KEY" | tr -d '[:space:]')"
if [ -z "$EMBED_KEY" ]; then
  echo "ERRO: chave vazia. Sem chave, a página do evento mostra só o link 'Abrir no Google Maps'." >&2
  exit 1
fi
if [[ ! "$EMBED_KEY" =~ ^AIza[0-9A-Za-z_-]{20,}$ ]]; then
  echo "AVISO: formato incomum para chave Google (esperado AIza...). Continuando mesmo assim."
fi

set_env_var "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY" "$EMBED_KEY" "$ENV_FILE"

DOMAIN="$(env_get DOMAIN "$ENV_FILE" 2>/dev/null || echo eventosbr.app.br)"

echo ""
echo "==> Google Maps configurado em $ENV_FILE"
echo "    NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=*** (oculta)"
echo ""
echo "IMPORTANTE: variável NEXT_PUBLIC_* entra no build do frontend."
echo "Após salvar, rebuild do container web:"
echo "  docker compose -f docker-compose.prod.yml build --no-cache web"
echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate web"
echo ""
echo "Ou no VPS:"
echo "  ./scripts/atualizar-vps-agora.sh"
echo ""
echo "Restrições recomendadas na chave (Google Cloud):"
echo "  - API: Maps Embed API"
echo "  - Referrers: https://${DOMAIN}/* , https://www.${DOMAIN}/*"
echo ""
echo "Teste: abra um evento com endereço preenchido e verifique o iframe do mapa."
