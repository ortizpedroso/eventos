#!/usr/bin/env bash
# Teste compra + split (mock) — rode no VPS dentro do container da API.
#
# Não use `python3 -m pytest` na raiz do servidor: pytest está na imagem Docker.
#
# Uso:
#   cd /opt/eventosbr
#   bash scripts/test-compra-split-mock.sh
#
# Opções repassadas ao pytest, ex.:
#   bash scripts/test-compra-split-mock.sh -k split

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"
TEST_FILE="tests/test_compra_split_fluxo_mock.py"

if ! docker compose -f "$COMPOSE" ps api --status running 2>/dev/null | grep -q running; then
  echo "==> API não está rodando — executando pytest em container temporário..."
  exec docker compose -f "$COMPOSE" run --rm --no-deps api \
    python3 -m pytest "$TEST_FILE" -v "$@"
fi

echo "==> Rodando pytest no container api ($TEST_FILE)..."
exec docker compose -f "$COMPOSE" exec -T api \
  python3 -m pytest "$TEST_FILE" -v "$@"
