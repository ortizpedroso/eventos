# 04 — Frontend (Next.js)

Pasta **`frontend/`**. App Router em **`src/app/`**.

## Configuração de build e proxy

| Ficheiro | Responsabilidade |
|----------|------------------|
| **`next.config.ts`** | `output: "standalone"` (imagem Docker); **`rewrites`**: `/api/:path*` → backend (`API_PROXY_TARGET` ou `INTERNAL_API_URL` ou `http://127.0.0.1:8000`); normalização para não duplicar `/api` no alvo; **`outputFileTracingRoot`**: raiz do monorepo para tracing correto |
| **`package.json`** | `dev`: `next dev --webpack -p 3000` |
| **`.env.local`** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PAYMENT_PROVIDER=asaas`, opcionais OAuth (ver `.env.local.example`) |

---

## Cliente HTTP: `src/lib/api.ts`

| Função | Comportamento |
|--------|----------------|
| `getPublicApiUrl()` | No browser: base vazia — chamadas usam o proxy same-origin `/api/*` do Next |
| `getApiBaseUrl()` | Alias do `getPublicApiUrl` — usado para chamadas diretas com `fetch` (QR, download) |
| `getServerApiUrl()` | SSR: prioriza `INTERNAL_API_URL` (Docker), senão `NEXT_PUBLIC_API_URL`, senão fallback `127.0.0.1:8000` |
| `apiFetch(path, init)` | Junta base + `path`; envia cookie `eventosbr_session` com `credentials: "include"`; define `Content-Type: application/json` por padrão quando há `body` e o chamador não definiu o header (evita 422 silencioso no FastAPI); em **401** dispara `dispatchAuthSync` e redireciona para `/auth?expirado=1` em rotas protegidas |
| Erros HTTP | Mensagens em português via `lib/api-errors.ts` (401, 403, 404, 429, etc.) |

---

## Autenticação no browser

- Sessão em **cookie HttpOnly** `eventosbr_session` (definido pela API no login/registo/compra rápida).
- **`middleware.ts`**: valida sessão chamando `/api/auth/me`; bloqueia `/organizador/*` para não-organizadores; exige cookie admin em `/api/admin/proxy` e sub-rotas `/admin/*`.
- **`lib/auth-sync`**: evento customizado para sincronizar estado de login entre componentes/abas.
- **`auth-client.tsx`**: tela de login/registo + botões OAuth Google; aviso quando `?expirado=1`.
- `GET /api/ingressos/{id}/qr` usa `fetch` com `credentials: "include"` para o cookie de sessão.

---

## Tipos: `src/lib/types.ts`

| Tipo | Campos principais |
|------|-------------------|
| `Evento` | `id`, `slug`, `nome`, `descricao`, `data_inicio/fim`, `local`, `imagem_url`, `preco_ingresso`, `preco_compra`, `lote_compra_id`, `ingresso_lotes`, `categoria`, `publicado`, `limite_ingressos_por_cpf` |
| `IngressoLote` | `id`, `nome`, `tipo`, `preco`, `ordem`, `quantidade_maxima`, `ativo`, `vendas_inicio/fim`, `vendidos` |
| `Usuario` | `id`, `email`, `nome`, `tipo`, `data_criacao`, `aceita_comunicacao_email/whatsapp`, `telefone`, `comunicacao_consentimento_em` |
| `IngressoListItem` | `id`, `evento`, `participante_nome/email`, `valor`, `status`, `data_compra`, **`repassado_para_nome`**, **`repassado_para_email`**, **`repassado_em`** |
| `PagamentoListItem` | `id`, `evento`, `participante_*`, `valor`, `status`, `data_compra`, `data_limite_cancelamento` |
| `TokenResponse` | `access_token`, `token_type`, `usuario` |
| `CriarPagamentoResponse` | `ingresso_id`, `aguardando_cobranca?`, `payments_disabled?`, `cortesia?`, `pix?` |

---

## Rotas de interface (App Router) — resumo

| Rota | Ficheiro / componente principal | Notas |
|------|---------------------------------|-------|
| `/` | `app/page.tsx` | Landing |
| `/eventos` | `app/eventos/page.tsx` + `eventos-lista-publica.tsx` | Lista pública |
| `/eventos/[slug]` | `evento-public-client.tsx` | Detalhe + compra; lotes e preço atual |
| `/eventos/[slug]/editar` | `editar-client.tsx` | Organizador dono |
| `/eventos/novo` | `novo-evento-client.tsx` | Criação |
| `/auth` | `auth-client.tsx` | Login / registo + botões OAuth Google |
| `/conta/perfil` | `perfil/page.tsx` | Edição de dados pessoais e senha |
| `/conta/pagamentos` | `pagamentos/page.tsx` | Lista de compras com opção de cancelamento |
| `/conta/ingressos` | `ingressos/page.tsx` | Lista de ingressos; badge âmbar "Repassado para [Nome]" |
| `/conta/ingressos/[id]` | `ingressos/[id]/page.tsx` | QR Code, baixar/imprimir, enviar e-mail, **formulário de repasse** |
| `/organizador/*` | layout shell | Meus eventos, novo evento, relatórios, financeiro, comunicados |
| `/termos`, `/privacidade`, `/sobre` | páginas estáticas | Conteúdo legal/informativo |

---

## Componentes relevantes

| Componente | Função |
|------------|--------|
| **`comprar-ingresso.tsx`** | Fluxo de compra: cria cobrança via API, participante opcional (CPF/tel), painel Asaas |
| **`checkout-asaas-painel.tsx`** | Checkout PIX, cartão e fatura via Asaas |
| **`compra-info-confianca.tsx`** | Bloco de confiança (denúncia, Asaas, links legais) |
| **`oauth-login-buttons.tsx`** | Botões de login social (Google); lê `/api/auth/oauth-config` para habilitar/desabilitar |
| **`evento-lotes-editor.tsx`** | UI de lotes no criar/editar; serialização para API |
| **`evento-imagem-field.tsx`** | URL ou ficheiro para imagem do evento |
| **`evento-hero-banner.tsx`** | Banner da página pública |
| **`site-footer.tsx`**, **`navbar.tsx`** | Navegação global |

---

## Funcionalidade de repasse de ingresso

Em **`/conta/ingressos/[id]`**, se `ingresso.status === "pago"`:

1. Card "Vender / repassar ingresso" (amber) com formulário: nome, CPF (formatado `000.000.000-00`), e-mail, telefone (formatado), data de nascimento.
2. `POST /api/ingressos/{id}/repassar` atualiza o participante no backend.
3. Após sucesso: banner de confirmação verde + badge âmbar na lista de ingressos.
4. Se o ingresso já foi repassado, o banner âmbar no topo do detalhe mostra "transferido para [Nome] em [data]".
5. O formulário de repasse permanece visível para permitir repassar novamente.

---

## Integração Asaas no front

- **`components/checkout-asaas-painel.tsx`**: checkout PIX, cartão e fatura via Asaas.
- **`comprar-ingresso.tsx`**: orquestra criação da cobrança e exibe o painel Asaas; `return_url` para a página do evento após pagamento.

---

## Organizador: publicar sem perder lotes

Em **`organizador/eventos/page.tsx`**, o PATCH de "publicar na vitrine" envia **`ingresso_lotes`** completos no corpo (`corpoAtualizarEvento`), para o backend não interpretar lista vazia como remoção de lotes.

---

## Estilos

- **`globals.css`**: `@import "tailwindcss"`, variáveis CSS, classes utilitárias `.btn-primary`, `.btn-success`, `.btn-outline`.
