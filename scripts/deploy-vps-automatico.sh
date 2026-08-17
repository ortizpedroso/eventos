#!/usr/bin/env bash
# Deploy VPS totalmente automatizado: branch de correção + sync contato/admin + verificação.
#
# Uso no servidor (único comando):
#   cd /opt/eventosbr && bash scripts/deploy-vps-automatico.sh
#
# Variáveis opcionais:
#   EVENTOSBR_DEPLOY_BRANCH=cursor/recover-whatsapp-admin-126d

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${EVENTOSBR_DEPLOY_BRANCH:-cursor/recover-whatsapp-admin-126d}"

echo "=============================================="
echo " EventosBR — deploy automático (branch: $BRANCH)"
echo "=============================================="

bash "$ROOT/scripts/atualizar-vps-branch.sh" "$BRANCH"
bash "$ROOT/scripts/post-deploy-contato-admin.sh"

echo ""
echo "✅ Deploy automático concluído: https://$(grep -m1 '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || echo eventosbr.app.br)"
