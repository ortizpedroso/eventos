#!/usr/bin/env bash
# Diagnóstico de roteamento Caddy ↔ EventosBR ↔ SIGEP no VPS compartilhado.
#
# Detecta colisão DNS Docker (dois containers no mesmo hostname upstream) e
# vazamento de HTML do SIGEP em eventosbr.app.br (sintoma clássico: /login).
#
# Uso no VPS:
#   cd /opt/eventosbr && ./scripts/verificar-roteamento-caddy.sh
#   cd /opt/eventosbr && ./scripts/verificar-roteamento-caddy.sh eventosbr.app.br
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ] && [ -f .env ]; then
  # shellcheck source=scripts/env-file-lib.sh
  source "$ROOT/scripts/env-file-lib.sh"
  DOMAIN="$(env_get DOMAIN .env 2>/dev/null || echo eventosbr.app.br)"
fi
DOMAIN="${DOMAIN:-eventosbr.app.br}"
URL="https://${DOMAIN}"
CADDY_CID="$(docker compose -f "$COMPOSE" ps -q caddy 2>/dev/null || true)"

fail=0

_echo() { printf '%s\n' "$*"; }

_echo "==> Roteamento EventosBR vs SIGEP"
_echo "    Domínio: ${DOMAIN}"
_echo ""

if [ -z "$CADDY_CID" ]; then
  _echo "  FALHA  container Caddy não encontrado (docker compose -f ${COMPOSE} ps caddy)"
  exit 1
fi

_echo "==> [1] Caddyfile montado (upstream do EventosBR)"
if docker exec "$CADDY_CID" grep -q 'reverse_proxy eventosbr-web:3000' /etc/caddy/Caddyfile 2>/dev/null; then
  _echo "  OK      Caddy aponta para eventosbr-web:3000"
elif docker exec "$CADDY_CID" grep -q 'reverse_proxy eventosbr_web:3000' /etc/caddy/Caddyfile 2>/dev/null; then
  _echo "  AVISO   Caddy usa alias eventosbr_web (preferir container_name eventosbr-web)"
  fail=1
elif docker exec "$CADDY_CID" grep -q 'reverse_proxy web:3000' /etc/caddy/Caddyfile 2>/dev/null; then
  _echo "  FALHA   Caddy ainda usa web:3000 (colide com SIGEP na mesma rede Docker)"
  fail=1
else
  _echo "  FALHA   upstream do frontend não reconhecido no Caddyfile"
  fail=1
fi

if docker exec "$CADDY_CID" grep -q '@legacy_login' /etc/caddy/Caddyfile 2>/dev/null; then
  _echo "  OK      redirect /login → /auth na borda (Caddy)"
else
  _echo "  AVISO   sem redirect /login no Caddy (recomendado)"
  fail=1
fi

_echo ""
_echo "==> [2] DNS Docker visto de dentro do Caddy (deve ser UM único IP por nome)"
for host in eventosbr-web eventosbr_web web metrica_web; do
  lines="$(docker exec "$CADDY_CID" sh -c "getent hosts ${host} 2>/dev/null" || true)"
  count="$(printf '%s\n' "$lines" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [ "$count" -eq 0 ]; then
    _echo "  —       ${host}: (sem registro — ok se não for upstream do EventosBR)"
  elif [ "$count" -eq 1 ]; then
    ip="$(printf '%s' "$lines" | awk '{print $1}')"
    _echo "  OK      ${host} → ${ip} (1 registro)"
  else
    _echo "  FALHA   ${host} → ${count} registros (round-robin / colisão):"
    printf '%s\n' "$lines" | sed 's/^/           /'
    fail=1
  fi
done

_echo ""
_echo "==> [3] Container eventosbr-web existe"
if docker ps --format '{{.Names}}' | grep -qx 'eventosbr-web'; then
  _echo "  OK      container eventosbr-web rodando"
else
  _echo "  FALHA   container eventosbr-web ausente — recrie: docker compose -f ${COMPOSE} up -d --force-recreate web caddy"
  fail=1
fi

_echo ""
_echo "==> [4] Amostragem HTTPS (${URL}) — procurar HTML do SIGEP"
samples="${ROUTING_SAMPLES:-40}"
sigep_hits=0
eventosbr_hits=0
login_redirects=0
other=0

for _ in $(seq 1 "$samples"); do
  # /login deve redirecionar para /auth (308/301) — nunca body do SIGEP
  code="$(curl -sk -o /dev/null -w '%{http_code}' "${URL}/login" 2>/dev/null || echo 000)"
  if [ "$code" = "301" ] || [ "$code" = "308" ] || [ "$code" = "307" ]; then
    login_redirects=$((login_redirects + 1))
  elif [ "$code" = "200" ]; then
    body="$(curl -sk "${URL}/login" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -qiE 'SIGEP-Força|sigep\.inovesw'; then
      sigep_hits=$((sigep_hits + 1))
    fi
  fi

  body_home="$(curl -sk "${URL}/" 2>/dev/null || true)"
  if printf '%s' "$body_home" | grep -qiE 'SIGEP-Força|sigep\.inovesw'; then
    sigep_hits=$((sigep_hits + 1))
  elif printf '%s' "$body_home" | grep -qi 'EventosBR'; then
    eventosbr_hits=$((eventosbr_hits + 1))
  else
    other=$((other + 1))
  fi
  sleep 0.2
done

_echo "  /login redirect (301/307/308): ${login_redirects}/${samples}"
_echo "  / com marca EventosBR:           ${eventosbr_hits}/${samples}"
if [ "$sigep_hits" -gt 0 ]; then
  _echo "  FALHA   SIGEP vazou ${sigep_hits}x em ${samples} amostras"
  fail=1
else
  _echo "  OK      nenhum HTML do SIGEP em ${samples} amostras"
fi

_echo ""
if [ "$fail" -eq 0 ]; then
  _echo "Roteamento OK."
  exit 0
fi

_echo "Correção sugerida no VPS:"
_echo "  cd /opt/eventosbr"
_echo "  git fetch origin && git reset --hard origin/main"
_echo "  docker compose -f ${COMPOSE} up -d --force-recreate web caddy"
_echo "  docker exec \$(docker compose -f ${COMPOSE} ps -q caddy) caddy reload --config /etc/caddy/Caddyfile"
_echo "  ./scripts/verificar-roteamento-caddy.sh ${DOMAIN}"
_echo ""
_echo "No SIGEP: upstream deve ser metrica_web:3000 (nunca web:3000 no bloco eventosbr.app.br)."
exit 1
