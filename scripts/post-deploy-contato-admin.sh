#!/usr/bin/env bash
# Pós-deploy: sincroniza WhatsApp (/contato) e admin da plataforma + verifica produção.
# Chamado por atualizar-vps-agora.sh e atualizar-vps-branch.sh — nada manual.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

COMPOSE="${COMPOSE:-docker-compose.prod.yml}"
DOMAIN="$(env_get DOMAIN .env 2>/dev/null || echo eventosbr.app.br)"

_ensure_env() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" .env 2>/dev/null; then
    set_env_var "$key" "$val" .env
    echo "  + .env: ${key}=${val}"
  fi
}

echo ""
echo "==> Sync contato/admin (automático)..."

email_user="$(env_get EMAIL_USER .env 2>/dev/null || true)"
if [ -n "$email_user" ]; then
  _ensure_env PLATFORM_OWNER_EMAIL "$email_user"
fi

tel_before="$(env_get TELEFONE_CONTATO .env 2>/dev/null || true)"
if [ -z "$tel_before" ]; then
  for src in NEXT_PUBLIC_TELEFONE_CONTATO NEXT_PUBLIC_SOCIAL_WHATSAPP_URL; do
    cand="$(env_get "$src" .env 2>/dev/null || true)"
    if [ -n "$cand" ]; then
      digits="$(printf '%s' "$cand" | tr -cd '0-9')"
      if [ "${#digits}" -ge 10 ]; then
        set_env_var TELEFONE_CONTATO "$digits" .env
        set_env_var NEXT_PUBLIC_TELEFONE_CONTATO "$digits" .env
        echo "  + .env: TELEFONE_CONTATO (de ${src})"
        break
      fi
    fi
  done
fi

tel_after="$(env_get TELEFONE_CONTATO .env 2>/dev/null || true)"
if [ -z "$tel_before" ] && [ -n "$tel_after" ]; then
  echo "  Recriando API para carregar TELEFONE_CONTATO..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  for _ in $(seq 1 24); do
    status="$(docker compose -f "$COMPOSE" ps api --format '{{.Health}}' 2>/dev/null || true)"
    if [ "$status" = "healthy" ]; then
      break
    fi
    sleep 5
  done
fi

if ! docker compose -f "$COMPOSE" exec -T api python3 scripts/sync_platform_contato_admin.py; then
  echo "  AVISO: sync_platform_contato_admin retornou erro (ver stderr acima)" >&2
fi

echo ""
echo "==> Verificação /contato + admin..."

platform_json="$(curl -fsS --max-time 20 "https://${DOMAIN}/api/public/platform" 2>/dev/null || true)"
phone="$(printf '%s' "$platform_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('contact_phone') or '')" 2>/dev/null || true)"
wa="$(printf '%s' "$platform_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('social_whatsapp_url') or '')" 2>/dev/null || true)"

if [ -n "$phone" ] || [ -n "$wa" ]; then
  echo "  OK  API platform: contact_phone=${phone:-—} whatsapp=${wa:-—}"
else
  echo "  FALHA  API sem telefone/WhatsApp — botão /contato não aparece"
  exit 1
fi

contato_html="$(curl -fsS --max-time 20 "https://${DOMAIN}/contato" 2>/dev/null || true)"
if printf '%s' "$contato_html" | grep -q 'Abrir WhatsApp'; then
  echo "  OK  /contato contém botão WhatsApp"
else
  echo "  FALHA  /contato sem botão Abrir WhatsApp (frontend desatualizado?)"
  exit 1
fi

admin_count="$(docker compose -f "$COMPOSE" exec -T api python3 -c "
from app.models import get_db, Usuario
db = next(get_db())
try:
    print(db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).count())
finally:
    db.close()
" 2>/dev/null || echo 0)"

if [ "${admin_count:-0}" -ge 1 ]; then
  echo "  OK  ${admin_count} conta(s) com is_platform_admin"
else
  echo "  FALHA  nenhum admin da plataforma"
  exit 1
fi

echo "  OK  contato/admin automatizado"
