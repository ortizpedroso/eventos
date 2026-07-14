#!/usr/bin/env bash
# Entra em modo sandbox: backup produção → aplica sandbox → reinicia API → testes.
#
# Uso:
#   ./scripts/setup-sandbox-pending.sh    # primeira vez (cria .env.asaas-sandbox-pending)
#   ./scripts/ir-sandbox-asaas.sh --reload
#
# Restaurar produção depois:
#   ./scripts/voltar-producao-asaas.sh --reload

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

PENDING="${PENDING_FILE:-.env.asaas-sandbox-pending}"
MARKER="${SANDBOX_MARKER:-.asaas-sandbox-active}"
RELOAD=0

for arg in "$@"; do
  case "$arg" in
    --reload) RELOAD=1 ;;
    -h|--help)
      echo "Uso: $0 [--reload]"
      echo ""
      echo "Requer $PENDING (use ./scripts/setup-sandbox-pending.sh)"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$PENDING" ]; then
  echo "ERRO: $PENDING não encontrado." >&2
  echo "  Rode: ./scripts/setup-sandbox-pending.sh" >&2
  echo "  Ou: cp .env.asaas-sandbox-pending.example $PENDING && nano $PENDING" >&2
  exit 1
fi

echo "=============================================="
echo " EventosBR — entrar em SANDBOX Asaas"
echo "=============================================="

echo ""
echo "[1/5] Backup completo da produção..."
./scripts/backup-prod-env.sh
./scripts/verify-prod-backup.sh || {
  echo "AVISO: backup com lacunas — revise antes de restaurar produção." >&2
}

# Cópia extra com data (pasta backups/)
mkdir -p backups
STAMP="$(date -u +"%Y%m%d-%H%M%S")"
cp -f .env.prod-backup "backups/env-prod-${STAMP}.env" 2>/dev/null || true
chmod 600 "backups/env-prod-${STAMP}.env" 2>/dev/null || true
echo "    Cópia extra: backups/env-prod-${STAMP}.env"

echo ""
echo "[2/5] Alternando .env para sandbox..."
ARGS=()
[ "$RELOAD" -eq 1 ] && ARGS+=(--reload)
./scripts/switch-asaas-sandbox.sh "${ARGS[@]}"

date -u +"%Y-%m-%dT%H:%M:%SZ" >"$MARKER"
echo "sandbox" >>"$MARKER"

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[3/5] Teste API sandbox..."
if [ "$RELOAD" -eq 0 ]; then
  PYTHONPATH="$ROOT" python3 scripts/test-asaas-connection.py || true
else
  ./scripts/test-asaas-sandbox.sh || true
fi

echo ""
echo "[4/5] Teste webhook..."
./scripts/test-asaas-webhook.sh || echo "AVISO: webhook falhou — veja painel Asaas (Ativo + fila + token)" >&2

echo ""
echo "[5/5] Checklist painel Asaas SANDBOX"
echo "  [ ] Webhook ATIVO (toggle ligado)"
echo "  [ ] Fila de sincronização LIGADA"
echo "  [ ] Reativar fila pausada em Logs de Webhooks"
echo "  [ ] URL: https://${DOMAIN}/api/webhooks/asaas"
echo "  [ ] Token = ASAAS_WEBHOOK_TOKEN do .env"
echo "  [ ] Organizador: Financeiro → Vincular walletId (conta sandbox secundária)"
echo ""
echo "✅ Modo sandbox ativo. Backup produção: .env.prod-backup"
echo "   Para voltar: ./scripts/voltar-producao-asaas.sh --reload"
