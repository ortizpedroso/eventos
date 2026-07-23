#!/usr/bin/env bash
# Verifica se o site em produção tem a versão esperada do código.
# Uso: ./scripts/verificar-versao-site.sh [DOMINIO]
set -euo pipefail

DOMAIN="${1:-eventosbr.app.br}"
URL="https://${DOMAIN}"

echo "==> Versão no GitHub (local/repo)"
git -C "$(cd "$(dirname "$0")/.." && pwd)" log -1 --oneline 2>/dev/null || echo "(sem git)"

echo ""
echo "==> Versão no site ao vivo: ${URL}"
HTML="$(curl -fsS --max-time 20 "${URL}/" || true)"

if [[ -z "$HTML" ]]; then
  echo "  FALHA  site não respondeu"
  exit 1
fi

ok=0

if echo "$HTML" | grep -q 'scroll-smooth'; then
  echo "  ANTIGO  html ainda tem scroll-smooth (deploy pendente)"
  ok=1
else
  echo "  OK      scroll-smooth removido"
fi

if echo "$HTML" | grep -q 'href="/organizador/novo"'; then
  echo "  OK      links apontam para /organizador/novo"
else
  echo "  ANTIGO  links ainda usam /auth?next=... (deploy pendente)"
  ok=1
fi

if echo "$HTML" | grep -q 'eventosbr-shell-layout'; then
  echo "  OK      CSS crítico do shell (rodapé) presente"
else
  echo "  ANTIGO  sem eventosbr-shell-layout — deploy pendente para fix do rodapé"
  ok=1
fi

if echo "$HTML" | grep -q 'eventosbr-early-scroll-reset'; then
  echo "  OK      script EarlyScrollReset presente (fix rodapé)"
else
  echo "  ANTIGO  sem EarlyScrollReset — deploy pendente para fix do rodapé"
  ok=1
fi

if echo "$HTML" | grep -qE 'grid min-h-dvh grid-rows-\[auto_1fr_auto\]|flex min-h-dvh flex-col'; then
  echo "  OK      layout do body (rodapé no fim)"
else
  echo "  ANTIGO  layout body sem shell estável — deploy pendente"
  ok=1
fi

echo ""
if [[ $ok -eq 0 ]]; then
  echo "Site parece ATUALIZADO com o último código UX."
else
  echo "Site ainda na versão ANTIGA — rode no VPS:"
  echo "  cd /opt/eventosbr && bash ./scripts/deploy-vps.sh"
  exit 1
fi
