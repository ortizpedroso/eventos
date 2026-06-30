#!/usr/bin/env bash
# Helpers para ler/gravar .env com chaves Asaas ($ no valor quebra `source .env`).
# Uso: source "$(dirname "$0")/env-file-lib.sh"

env_get() {
  local key="$1"
  local file="${2:-${ENV_FILE:-.env}}"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  [[ -n "$line" ]] || return 1
  local val="${line#*=}"
  val="${val%$'\r'}"
  val="${val//\$\$/\$}"
  printf '%s' "$val"
}

docker_env_escape() {
  printf '%s' "$1" | sed 's/\$/$$/g'
}

env_is_placeholder() {
  case "${1:-}" in
    ""|*GERE_*|*GERE_COM_*|*cole_aqui*|*changeme*|*placeholder*|*aact_prod_...*|*aact_hmlg_...*)
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
  escaped="$(docker_env_escape "$val")"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # shellcheck disable=SC2016
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  else
    echo "${key}=${escaped}" >>"$file"
  fi
}
