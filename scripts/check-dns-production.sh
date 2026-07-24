#!/usr/bin/env bash
# Verifica se o DNS do domínio aponta para o IP esperado do VPS (antes/depois do go-live).
#
# Uso:
#   ./scripts/check-dns-production.sh
#   ./scripts/check-dns-production.sh eventosbr.app.br 187.77.240.125

set -euo pipefail

DOMAIN="${1:-eventosbr.app.br}"
EXPECTED_IP="${2:-187.77.240.125}"

resolve_a() {
  local host="$1"
  if command -v dig >/dev/null 2>&1; then
    dig +short "$host" A 2>/dev/null | head -1
  elif command -v host >/dev/null 2>&1; then
    host -t A "$host" 2>/dev/null | awk '/has address/ { print $4; exit }'
  else
    getent ahosts "$host" 2>/dev/null | awk '/STREAM/ { print $1; exit }'
  fi
}

check_host() {
  local label="$1"
  local host="$2"
  local ip
  ip="$(resolve_a "$host" || true)"
  if [[ -z "$ip" ]]; then
    echo "  FALHA  $label ($host) — sem registro A (DNS ainda não propagou?)"
    return 1
  fi
  if [[ "$ip" == "$EXPECTED_IP" ]]; then
    echo "  OK     $label ($host) → $ip"
    return 0
  fi
  echo "  FALHA  $label ($host) → $ip (esperado: $EXPECTED_IP)"
  return 1
}

echo "==> DNS EventosBR"
echo "    Domínio: $DOMAIN"
echo "    IP VPS:  $EXPECTED_IP"
echo ""

fail=0
check_host "apex" "$DOMAIN" || fail=1
check_host "www" "www.$DOMAIN" || fail=1

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "DNS OK. Próximo: docker compose -f docker-compose.prod.yml up -d --build"
  echo "Depois: ./scripts/verify-production.sh"
else
  echo "Configure no Registro.br / Hostinger:"
  echo "  Tipo A | Nome @   | Valor $EXPECTED_IP"
  echo "  Tipo A | Nome www | Valor $EXPECTED_IP"
  echo "Aguarde propagação (5–60 min) e execute este script novamente."
  exit 1
fi
