#!/usr/bin/env bash
# Monitora /ready e alerta se a API estiver indisponível.
# Uso no cron (a cada 5 min):
#   */5 * * * * cd /opt/eventosbr && ./scripts/monitor-ready.sh
#
# Variáveis (.env):
#   DOMAIN                    — domínio público
#   MONITOR_ALERT_WEBHOOK_URL — POST JSON em falha (Slack, Discord, n8n, etc.)
#   MONITOR_ALERT_EMAIL       — opcional; requer mail/sendmail

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi

DOMAIN="${DOMAIN:-localhost}"
BASE="${MONITOR_BASE_URL:-https://${DOMAIN}}"
READY_URL="${BASE}/ready"
STATE_DIR="${MONITOR_STATE_DIR:-$ROOT/backups}"
STATE_FILE="$STATE_DIR/monitor-ready.state"
LOG_FILE="${MONITOR_LOG:-$STATE_DIR/monitor-ready.log}"
mkdir -p "$STATE_DIR"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HTTP_CODE=""
BODY=""

if RESP="$(curl -fsS --max-time 20 -w '\n%{http_code}' "$READY_URL" 2>/dev/null || true)"; then
  HTTP_CODE="$(echo "$RESP" | tail -n1)"
  BODY="$(echo "$RESP" | sed '$d')"
else
  HTTP_CODE="000"
fi

OK=0
if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q '"database"'; then
  OK=1
fi

PREV_FAIL=0
[ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE" 2>/dev/null)" = "fail" ] && PREV_FAIL=1

if [ "$OK" -eq 1 ]; then
  echo "$TS OK $READY_URL ($HTTP_CODE)" >>"$LOG_FILE"
  echo "ok" >"$STATE_FILE"
  exit 0
fi

echo "$TS FALHA $READY_URL ($HTTP_CODE) $BODY" >>"$LOG_FILE"
echo "fail" >"$STATE_FILE"

# Alerta só na transição ou a cada falha se MONITOR_ALERT_ALWAYS=1
if [ "$PREV_FAIL" -eq 1 ] && [ "${MONITOR_ALERT_ALWAYS:-0}" != "1" ]; then
  exit 1
fi

MSG="EventosBR /ready FALHOU em $READY_URL (HTTP $HTTP_CODE) em $TS"

if [ -n "${MONITOR_ALERT_WEBHOOK_URL:-}" ]; then
  curl -fsS --max-time 15 -X POST "$MONITOR_ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"$MSG\",\"status\":\"$HTTP_CODE\",\"url\":\"$READY_URL\"}" \
    >/dev/null 2>&1 || true
fi

if [ -n "${MONITOR_ALERT_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
  echo "$MSG" | mail -s "EventosBR: /ready indisponível" "$MONITOR_ALERT_EMAIL" 2>/dev/null || true
fi

exit 1
