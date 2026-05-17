# 04 — Frontend (Next.js)

Pasta **`frontend/`**. App Router em **`src/app/`**.

## Configuração de build e proxy

| Ficheiro | Responsabilidade |
|----------|------------------|
| **`next.config.ts`** | `output: "standalone"` (imagem Docker); **`rewrites`**: `/api/:path*` → backend (`API_PROXY_TARGET` ou `INTERNAL_API_URL` ou `http://127.0.0.1:8000`); normalização para não duplicar `/api` no alvo; **`outputFileTracingRoot`**: raiz do monorepo para tracing correto |
| **`package.json`** | `dev`: `next dev --webpack -p 3000` |
| **`.env.local`** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, opcionais de email/social (ver `.env.local.example`) |

## Cliente HTTP: `src/lib/api.ts`

| Função | Comportamento |
|--------|----------------|
| `getPublicApiUrl()` | No browser: base vazia ou URL normalizada; se API é localhost e a página não é loopback, devolve `""` para forçar **proxy same-origin** |
| `getServerApiUrl()` | SSR: prioriza `INTERNAL_API_URL` (Docker), senão `NEXT_PUBLIC_API_URL`, senão fallback `127.0.0.1:8000` |
| `apiFetch(path, init)` | Junta base + `path`; envia `Authorization: Bearer` se `localStorage.eventosbr_token`; em **401** remove token e dispara `dispatchAuthSync` |
| Erros 422 | Monta mensagem a partir de `detail[]` com `loc` + `msg` |

## Autenticação no browser

- Token em **`localStorage`** chave `eventosbr_token` (ver também `auth-client.tsx` e páginas que verificam sessão).
- **`lib/auth-sync`**: evento customizado para sincronizar estado de login entre componentes/abas.

## Tipos: `src/lib/types.ts`

Define **`Evento`**, **`IngressoLote`**, **`Usuario`**, respostas de pagamento, etc. Deve refletir contratos JSON da API (`ingresso_lotes`, `preco_compra`, `lote_compra_id`).

## Rotas de interface (App Router) — resumo

| Rota | Ficheiro / componente | Notas |
|------|------------------------|-------|
| `/` | `app/page.tsx` | Landing |
| `/eventos` | `app/eventos/page.tsx`, `eventos-lista-publica.tsx` | Lista pública (fetch no cliente para usar mesmo `/api` que o utilizador) |
| `/eventos/[slug]` | `evento-public-client.tsx` | Detalhe + compra; lotes e preço atual |
| `/eventos/[slug]/editar` | `editar-client.tsx` | Organizador dono |
| `/eventos/novo` | `novo-evento-client.tsx` | Criação (standalone ou painel) |
| `/auth` | `auth-client.tsx` | Login/registo |
| `/conta/*` | várias | Perfil, pagamentos, ingressos |
| `/organizador/*` | layout shell | Meus eventos, novo, relatórios, financeiro |
| `/termos`, `/privacidade`, `/sobre` | páginas estáticas | Conteúdo legal/informativo |

## Componentes relevantes

| Componente | Função |
|------------|--------|
| **`comprar-ingresso.tsx`** | Fluxo Stripe Elements: cria intent via API, participante opcional (CPF/tel), `ConfirmForm` |
| **`compra-info-confianca.tsx`** | Bloco de confiança (denúncia, Stripe, links legais); usado na página pública abaixo dos cards |
| **`evento-lotes-editor.tsx`** | UI de lotes no criar/editar; serialização para API |
| **`evento-imagem-field.tsx`** | URL ou ficheiro (nota de produto: upload local no formulário) |
| **`evento-hero-banner.tsx`** | Banner da página pública |
| **`site-footer.tsx`**, **`navbar.tsx`** | Navegação global; links para termos/privacidade |

## Integração Stripe no front

- **`lib/stripe-client.ts`**: lazy load de `loadStripe` com publishable key.
- **`comprar-ingresso.tsx`**: `<Elements clientSecret=...>` + `PaymentElement`; `return_url` para área de pagamentos após redirect methods.

## Organizador: publicar sem perder lotes

Em **`organizador/eventos/page.tsx`**, o PATCH de “publicar na vitrine” envia **`ingresso_lotes`** completos no corpo (`corpoAtualizarEvento`), para o backend não interpretar lista vazia como remoção de lotes.

## Estilos

- **`globals.css`**: `@import "tailwindcss"`, variáveis CSS, classes utilitárias `.btn-primary`, `.btn-success`, `.btn-outline`.
