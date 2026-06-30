#!/usr/bin/env bash
# Mescla chaves novas de .env.production.example no .env do VPS sem sobrescrever valores existentes.
#
# Uso no servidor (após git pull):
#   cd /opt/eventosbr
#   ./scripts/update-env-vps.sh
#   nano .env   # preencher placeholders das chaves adicionadas
#   docker compose -f docker-compose.prod.yml up -d

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXAMPLE="${ENV_EXAMPLE:-.env.production.example}"
TARGET="${ENV_TARGET:-.env}"

if [ ! -f "$EXAMPLE" ]; then
  echo "ERRO: exemplo não encontrado: $EXAMPLE" >&2
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  echo "==> $TARGET não existe — copiando de $EXAMPLE"
  cp "$EXAMPLE" "$TARGET"
  echo "Edite $TARGET antes do deploy: nano $TARGET"
  exit 0
fi

backup="${TARGET}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$TARGET" "$backup"
echo "==> Backup: $backup"

declare -A existing_keys=()
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;
    *=*)
      key="${line%%=*}"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      existing_keys["$key"]=1
      ;;
  esac
done < "$TARGET"

added=0
block=()
flush_block() {
  if [ "${#block[@]}" -eq 0 ]; then
    return
  fi
  local key=""
  for entry in "${block[@]}"; do
    case "$entry" in
      *=*)
        key="${entry%%=*}"
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        break
        ;;
    esac
  done
  if [ -n "$key" ] && [ -z "${existing_keys[$key]+x}" ]; then
    printf '\n' >> "$TARGET"
    printf '%s\n' "${block[@]}" >> "$TARGET"
    existing_keys["$key"]=1
    added=$((added + 1))
    echo "  + $key"
  fi
  block=()
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*)
      flush_block
      ;;
    *=*)
      block+=("$line")
      flush_block
      ;;
    *)
      if [ "${#block[@]}" -gt 0 ]; then
        block+=("$line")
      fi
      ;;
  esac
done < "$EXAMPLE"
flush_block

if [ "$added" -eq 0 ]; then
  echo "==> Nenhuma chave nova — $TARGET já está alinhado com $EXAMPLE"
else
  echo ""
  echo "==> $added bloco(s) adicionado(s). Revise: nano $TARGET"
  echo "    Depois: docker compose -f docker-compose.prod.yml up -d"
fi
