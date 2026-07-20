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

if echo "$HTML" | grep -q 'ScrollToTop\|scroll-to-top'; then
  echo "  OK      componente ScrollToTop presente"
else
  echo "  INFO    ScrollToTop não visível no HTML (normal — está no JS)"
fi

echo ""
if [[ $ok -eq 0 ]]; then
  echo "Site parece ATUALIZADO com o último código UX."
else
  echo "Site ainda na versão ANTIGA — rode no VPS:"
  echo "  cd /opt/eventosbr && bash ./scripts/deploy-vps.sh"
  exit 1
fi
