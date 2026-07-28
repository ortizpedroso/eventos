#!/usr/bin/env bash
# Helpers para ler/gravar .env com chaves Asaas ($ no valor quebra `source .env`).
# Uso: source "$(dirname "$0")/env-file-lib.sh"

env_unquote() {
  local val="$1"
  if [[ "$val" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
    val="${val//\\\"/\"}"
    val="${val//\\\\/\\}"
  elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

env_get() {
  local key="$1"
  local file="${2:-${ENV_FILE:-.env}}"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  [[ -n "$line" ]] || return 1
  local val="${line#*=}"
  val="${val%$'\r'}"
  val="$(env_unquote "$val")"
  val="${val//\$\$/\$}"
  printf '%s' "$val"
}

docker_env_escape() {
  printf '%s' "$1" | sed 's/\$/$$/g'
}

# Valores com #, espaço, $ ou aspas precisam ir entre aspas duplas no .env do Docker Compose.
env_format_for_file() {
  local val="$1"
  if [[ "$val" =~ [\ \#\$\"\'\\] ]]; then
    val="${val//\\/\\\\}"
    val="${val//\"/\\\"}"
    val="${val//\$/\$\$}"
    printf '"%s"' "$val"
  else
    docker_env_escape "$val"
  fi
}

env_is_placeholder() {
  case "${1:-}" in
    ""|*GERE_*|*GERE_COM_*|*cole_aqui*|*COLE_SUA_*|*changeme*|*placeholder*|*aact_prod_...*|*aact_hmlg_...*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

set_env_var() {
  local key="$1"
  local val="$2"
  local file="${3:-${ENV_FILE:-.env}}"
  local escaped
  escaped="$(env_format_for_file "$val")"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # shellcheck disable=SC2014
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  else
    echo "${key}=${escaped}" >>"$file"
  fi
}
