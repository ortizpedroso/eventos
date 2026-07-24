#!/usr/bin/env bash
# Verifica se o site em produção tem a versão esperada do código.
# Uso: ./scripts/verificar-versao-site.sh [DOMINIO]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${1:-eventosbr.app.br}"
URL="https://${DOMAIN}"
EXPECTED="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo "")"

echo "==> Versão esperada (git local): ${EXPECTED:-?} $(git -C "$ROOT" log -1 --oneline 2>/dev/null || true)"
echo ""
echo "==> Versão no site ao vivo: ${URL}"

ok=0

if ! curl -fsS --max-time 20 "${URL}/ready" >/dev/null 2>&1; then
  echo "  FALHA  /ready não respondeu"
  exit 1
fi
echo "  OK      /ready"

api_json="$(curl -fsS --max-time 20 "${URL}/api/public/version" 2>/dev/null || true)"
api_commit="$(printf '%s' "$api_json" | python3 -c "import json,sys; d=sys.stdin.read();
try:
  print(json.loads(d).get('git_commit',''))
except Exception:
  print('')" 2>/dev/null || true)"

web_commit="$(curl -fsS --max-time 20 "${URL}/" 2>/dev/null \
  | grep -o 'data-eventosbr-build="[^"]*"' \
  | head -1 \
  | sed 's/data-eventosbr-build="//;s/"$//' || true)"

echo "  API commit:  ${api_commit:-?}"
echo "  Web commit:  ${web_commit:-?}"

if [ -n "$EXPECTED" ] && [ "$api_commit" != "$EXPECTED" ]; then
  echo "  FALHA  API desatualizada (esperado ${EXPECTED})"
  ok=1
else
  echo "  OK      API na versão esperada"
fi

if [ -n "$EXPECTED" ] && [ "$web_commit" != "$EXPECTED" ]; then
  echo "  FALHA  frontend desatualizado (esperado ${EXPECTED})"
  ok=1
else
  echo "  OK      frontend na versão esperada"
fi

if printf '%s' "$api_json" | grep -q '"asset_upload"'; then
  echo "  OK      white-label (upload) na API"
else
  echo "  FALHA  /api/public/version sem features white-label"
  ok=1
fi

if curl -fsS --max-time 20 "${URL}/api/public/tenant?subdomain=__check__" 2>/dev/null \
  | grep -q 'Organizador não encontrado'; then
  echo "  OK      rota /api/public/tenant"
else
  echo "  FALHA  rota /api/public/tenant ausente"
  ok=1
fi

echo ""
if [[ $ok -eq 0 ]]; then
  echo "Site ATUALIZADO (${EXPECTED})."
  echo "  Admin → Configurações: upload logo/favicon"
  echo "  Organizador → Perfil → Marca (white-label)"
else
  echo "Site DESATUALIZADO — rode no VPS:"
  echo "  cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh"
  exit 1
fi
