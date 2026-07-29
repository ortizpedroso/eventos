# Spec: Admin integrado à conta do usuário (papel `is_platform_admin`)

**Versão:** 1.0
**Data:** 2026-07-25
**Status:** ✅ Implementada e validada em produção (v1.11 da spec principal)

## 1. Objetivo

Permitir que uma conta de usuário (cliente ou organizador) tenha também o papel de
administrador da plataforma, acessando o painel administrativo via **login normal**
(e-mail + senha + 2FA obrigatório), em vez de exigir uma chave compartilhada separada
(`PLATFORM_ADMIN_API_KEY`) toda vez.

Isso permite: a mesma pessoa ser organizador **e** admin, ou cliente **e** admin — e o
dono da plataforma poder conceder/revogar esse papel para outras contas.

## 2. Contexto / decisões já tomadas

- **2FA obrigatório** para qualquer conta com `is_platform_admin=True` (decisão do usuário
  — sem isso, comprometer a senha da conta normal daria acesso administrativo total).
- **Primeiro admin definido por script** rodado manualmente uma vez (não por variável de
  ambiente automática) — mais explícito e auditável.
- **`PLATFORM_ADMIN_API_KEY` continua existindo** como acesso de emergência/backup (ex.:
  se a conta do dono ficar inacessível) — não é removida, só deixa de ser o caminho
  principal do dia a dia.

## 3. Requisitos exatos

### 3.1 Modelo de dados
- Novo campo `Usuario.is_platform_admin: bool` (default `False`).
- `is_platform_admin` é **independente** de `tipo` (cliente/organizador) — qualquer
  combinação é válida.

### 3.2 2FA (TOTP) disponível para admin, não só organizador
- Hoje `iniciar_totp()` bloqueia com `if usuario.tipo != "organizador": raise TotpError`.
- Passa a permitir TOTP se `tipo == "organizador"` **OU** `is_platform_admin == True`
  (um cliente-admin precisa poder ativar 2FA mesmo não sendo organizador).

### 3.3 Autenticação do painel admin (dupla via)
A dependency que hoje só aceita `X-Platform-Admin-Key` (`require_platform_admin`) passa
a aceitar **qualquer uma** das duas formas:
1. **Sessão de usuário normal** (o mesmo JWT/cookie do login comum) de uma conta com
   `is_platform_admin == True` **e** `totp_ativado == True`. Se `is_platform_admin=True`
   mas `totp_ativado=False`, o acesso é **negado** com mensagem clara orientando a
   ativar 2FA primeiro (o login normal da conta continua funcionando normalmente — só o
   acesso às rotas `/admin/*` fica bloqueado).
2. **`X-Platform-Admin-Key`** (mecanismo atual, inalterado) — continua funcionando como
   está, sem exigir 2FA (é o acesso de emergência).

### 3.4 Gerenciamento de administradores
- Nova tela dentro do painel admin: lista de usuários com um controle para
  ativar/desativar `is_platform_admin` em qualquer conta.
- Ao desativar o próprio acesso, mostrar aviso de confirmação (mas permitir — não travar
  a ação).
- Toda alteração gera entrada no audit log já existente (`admin_action=...`).

### 3.5 Menu / navegação
- Usuário com `is_platform_admin == True` e `totp_ativado == True`, ao logar
  normalmente, vê um item extra de navegação (no shell que já está usando — organizador
  ou conta) levando ao painel administrativo. Sem precisar colar chave nenhuma.
- Se `is_platform_admin == True` mas `totp_ativado == False`: mostrar o item de menu
  mesmo assim, mas ao clicar, redirecionar para a tela de ativação de 2FA com uma
  explicação (“Ative o 2FA para acessar o painel administrativo”).

### 3.6 Script de definição do primeiro admin
- `scripts/set_platform_admin.py <email>` — script Python rodado manualmente (dentro do
  container da API), idempotente, que:
  - Busca o usuário pelo e-mail.
  - Marca `is_platform_admin = True`.
  - Se o e-mail não existir, erro claro (não cria conta nova).
  - Imprime um aviso lembrando que 2FA precisa ser ativado pela própria pessoa depois
    (o script não pode ativar 2FA por ela, já que TOTP exige escanear QR code).

## 4. Casos extremos

- Conta com `is_platform_admin=True` mas TOTP nunca ativado: login funciona, painel
  admin bloqueado até ativar 2FA (ver 3.3).
- Único admin remove o próprio `is_platform_admin`: permitido, com confirmação — a
  chave `PLATFORM_ADMIN_API_KEY` continua disponível como via de recuperação.
- Usuário desativa o próprio 2FA depois de já ter acesso admin: acesso ao painel passa a
  ser bloqueado imediatamente na próxima requisição (checagem é sempre em tempo real, não
  cacheada).
- Chave `PLATFORM_ADMIN_API_KEY` e sessão de usuário-admin podem ser usadas
  simultaneamente por pessoas diferentes sem conflito (mecanismos independentes).

## 5. Definição de "concluído"

- [x] Migração: `usuarios.is_platform_admin` (bool, default false)
- [x] `organizador_2fa.py`: TOTP liberado para `tipo == "organizador" OR is_platform_admin`
- [x] `require_platform_admin` aceita sessão de usuário (JWT/cookie) com
      `is_platform_admin=True and totp_ativado=True`, além da chave estática
- [x] Endpoint(s) para listar usuários e alternar `is_platform_admin` (só acessível por
      quem já é admin)
- [x] Frontend: item de menu condicional (organizador-shell e conta-shell) para quem tem
      `is_platform_admin=True`
- [x] Frontend: tela de gerenciamento de admins dentro do painel
- [x] `scripts/set_platform_admin.py`
- [x] Testes: acesso negado sem 2FA, acesso liberado com 2FA ativo, toggle de admin por
      outro admin, chave antiga (`X-Platform-Admin-Key`) continua funcionando sem 2FA
- [x] `pytest` verde, `tsc`/`eslint`/build de produção sem erros
- [x] Migração validada contra Postgres real (upgrade → downgrade → upgrade)

**Correções v1.16 (encontradas em `/review`, aplicadas por `/build`)** — os itens do
backend acima já estavam corretos, mas três gaps de UX/edge-case do frontend e testes
não estavam:

- §3.2: `SegurancaDoisFatores` só aparecia para `user.tipo === "organizador"` — um
  cliente com `is_platform_admin=True` não tinha como ativar o 2FA pela UI (o backend
  já permitia). Corrigido em `perfil-client.tsx`.
- §3.5: item "Administração" sem 2FA ativo ia direto pra `/admin/dashboard` (tela de
  colar chave), não pra ativação de 2FA como a spec pede. Corrigido nos três pontos de
  entrada (`conta-shell.tsx`, `organizador-shell.tsx`, `navbar.tsx`) — o link agora
  aponta pra `/conta/perfil?ativar_2fa_admin=1` (ou `/organizador/perfil`), que exibe um
  banner explicativo e rola até a seção de 2FA automaticamente.
- §3.4/§4: confirmação ao remover o próprio acesso admin usava o mesmo texto genérico de
  remover qualquer usuário. Corrigido em `admin-dashboard-client.tsx` — mensagem
  específica quando `u.id === meuUsuarioId`. Também adicionado teste automatizado que
  desativa o 2FA de uma conta admin e confirma bloqueio imediato do painel (§4).

Validado manualmente via `computerUse`: fluxo completo (login sem 2FA → banner → ativar
2FA → acesso liberado → auto-remoção com aviso específico).

## 6. Fora de escopo (nesta versão)

- Remoção do `PLATFORM_ADMIN_API_KEY` (mantido como fallback, por decisão do usuário)
- Níveis diferentes de admin (super-admin vs admin limitado) — hoje é binário: é ou não é
- Notificação por e-mail quando alguém ganha/perde acesso admin
