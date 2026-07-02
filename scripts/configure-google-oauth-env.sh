#!/usr/bin/env bash
# Configura login com Google (GOOGLE_OAUTH_CLIENT_ID) no .env.
#
# Pré-requisitos no Google Cloud Console (projeto eventosbr):
#
#   A) Tela de permissão OAuth (obrigatório — remove o aviso amarelo)
#      Menu → APIs e serviços → Tela de permissão OAuth → Configurar
#      - Tipo: Externo
#      - Nome do app: EventosBR
#      - E-mail de suporte: contato@eventosbr.app.br
#      - Domínios autorizados: eventosbr.app.br
#      - Página inicial: https://eventosbr.app.br
#      - Política de privacidade: https://eventosbr.app.br/privacidade (ou /termos)
#      - Adicionar escopos: .../auth/userinfo.email, .../auth/userinfo.profile, openid
#      - Usuários de teste: seu e-mail (enquanto app em "Teste")
#      - Publicar app (ou manter em teste com usuários de teste)
#
#   B) Credencial OAuth 2.0 (IDs do cliente OAuth 2.0 → Criar → Aplicativo da Web)
#      - Nome: EventosBR Web
#      - Origens JavaScript autorizadas:
#          https://eventosbr.app.br
#          https://www.eventosbr.app.br
#          http://localhost:3000
#      - URIs de redirecionamento (opcional para GIS, mas recomendado):
#          https://eventosbr.app.br/auth
#          https://eventosbr.app.br/auth/login
#          https://eventosbr.app.br/auth/register
#
# Uso:
#   ./scripts/configure-google-oauth-env.sh
#   ./scripts/configure-google-oauth-env.sh --client-id '123....apps.googleusercontent.com'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE="$ROOT/.env.production.example"
CLIENT_ID=""

usage() {
  echo "Uso: $0 [--client-id ID]"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --client-id) CLIENT_ID="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

if [ -z "$CLIENT_ID" ]; then
  echo ""
  echo "Login com Google — OAuth 2.0 Client ID (tipo Aplicativo da Web)"
  echo "Console: https://console.cloud.google.com/apis/credentials"
  echo ""
  echo "Antes de criar a credencial, configure a Tela de permissão OAuth:"
  echo "  https://console.cloud.google.com/apis/credentials/consent"
  echo ""
  read -r -p "GOOGLE_OAUTH_CLIENT_ID (....apps.googleusercontent.com): " CLIENT_ID
fi

CLIENT_ID="$(printf '%s' "$CLIENT_ID" | tr -d '[:space:]')"
if [ -z "$CLIENT_ID" ]; then
  echo "ERRO: Client ID vazio." >&2
  exit 1
fi
if [[ ! "$CLIENT_ID" =~ \.apps\.googleusercontent\.com$ ]]; then
  echo "AVISO: formato incomum (esperado ....apps.googleusercontent.com). Continuando."
fi

set_env_var "GOOGLE_OAUTH_CLIENT_ID" "$CLIENT_ID" "$ENV_FILE"
set_env_var "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID" "$CLIENT_ID" "$ENV_FILE"

DOMAIN="$(env_get DOMAIN "$ENV_FILE" 2>/dev/null || echo eventosbr.app.br)"

echo ""
echo "==> Google OAuth configurado em $ENV_FILE"
echo "    GOOGLE_OAUTH_CLIENT_ID=*** (oculto)"
echo "    NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=*** (oculto)"
echo ""
echo "Reinicie API e rebuild do frontend:"
echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate api"
echo "  docker compose -f docker-compose.prod.yml build --no-cache web"
echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate web"
echo ""
echo "Ou: ./scripts/atualizar-vps-agora.sh"
echo ""
echo "Verifique:"
echo "  curl -s https://${DOMAIN}/api/auth/oauth-config"
echo "  → deve retornar google_enabled: true"
echo ""
echo "Origens JavaScript obrigatórias na credencial Google:"
echo "  https://${DOMAIN}"
echo "  https://www.${DOMAIN}"
