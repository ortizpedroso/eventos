# Spec: EventosBR — Produção, produto e pagamentos

**Versão:** 1.50.9
**Data:** 2026-08-05
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

> **Documento único** de referência para publicação do sistema. Substitui `repasse-asaas-pagamentos.md` e `patamar-completo-ux-produto.md`.
>
> **Esta versão (v1.50.9):** correções pertinentes da auditoria de lançamento (§2.21) — erro de API em produção, upload fail-closed, not-found/error, sitemap paginado, SSR produtor, Twitter metadata, robots, `migrate_encryption` completo, Next 16.3.0.
>
> **Produção (VPS):** tip **`e370a63`** / v1.50.8 até deploy desta versão. Repo **privado** + Deploy Key SSH.
>
> **Fluxo de trabalho (a partir da v1.8):** o repositório passou a usar commits diretos em `main` (sem PRs de longa duração) — em 07/2026 foram revisadas e fechadas 29 PRs antigas cujo conteúdo já estava incorporado à `main` por outros caminhos. Esta spec é o documento vivo do sistema: **toda mudança relevante deve atualizar este arquivo** (`/build` + `/review` seguido de atualização da spec).

---

## 1. Objetivo

Publicar o EventosBR (`eventosbr.app.br`) como plataforma de ingressos com:

- Pagamentos integrados (PIX, cartão, boleto) — processador **Asaas** em produção, **invisível ao usuário final**
- Repasse automático ao organizador via **split**
- Cada organizador possui **conta de recebimento** criada e gerida **pela plataforma** (sem conta Asaas separada, sem “subconta” exposta na UX)
- UX de compra, conta, organizador e portaria em nível de mercado
- Segurança e configuração prontas para **produção**

**Marca:** EventosBR · **Domínio:** `eventosbr.app.br`

---

## 2. Pagamentos e repasse

### 2.1 Split na venda

| Destino | O que recebe | Como |
|---------|----------------|------|
| Organizador | Preço − taxa EventosBR − descontos | `split[].walletId` = wallet da **conta de recebimento** do organizador |
| Plataforma | Taxa EventosBR (% + fixo) | Permanece na conta emissora EventosBR (fora do `split`) |
| Processador | Taxas do gateway | Fora do split |

Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

Ledger por ingresso: `financeiro_organizador.py` → `registrar_ledger_ingressos_lote()`.

### 2.1.1 Ingresso grátis / cortesia — sem taxa EventosBR (v1.24)

Ingresso com valor ≤ R$0 **não gera** taxa percentual nem fixa. `taxa_ingresso` e
`detalhar_taxa_ingresso` (backend) / `detalharTaxaIngresso` (frontend) devem
concordar: taxa total = 0 e líquido = 0.

**Bug corrigido (v1.24):** `detalhar_taxa_ingresso(0)` ainda aplicava a taxa fixa
(R$2 no plano padrão) e gravava `taxa_plataforma_aplicada` no ledger. O Financeiro
lia o valor persistido e mostrava taxa fantasma (ex.: R$4 para 2 cortesias), embora
o comprador não fosse cobrado. Correção:

1. Detalhe/ledger alinhados a taxa zero para valor ≤ 0.
2. Backfill `corrigir_taxa_ingressos_gratis` (API pública em
   `financeiro_organizador.py`) ao abrir saldo, extrato, vendas agrupadas e
   relatório do organizador — zera registros antigos em batches.
3. Testes: `tests/test_taxa_ingresso_gratis.py`.

### 2.9 Carrinho abandonado, promoters e galeria (v1.25 / 1.25.1)

Plano: `specs/plano-carrinho-afiliados-galeria.md` (**§7/§11 — build aprovada**).

**Carrinho abandonado (transacional):** worker `lembrete_carrinho.py` envia **um** e-mail via `enqueue_email_simples` **20 min** após `data_compra`, se `status=pendente` e `reservado_ate` ainda no futuro (reserva = 35 min). Idempotência: claim atômico em `carrinho_lembrete_enviado_em` antes do enqueue (segundo cron na janela da reserva não reenvia). CTA: `/eventos/{slug}?retomar={id}#comprar`. Não exige opt-in de marketing; rodapé com link de preferências. Não altera checkout/pagamento. `cancelado` não recebe lembrete (teste A1).

**Promoters:** tabela `evento_promoters`; link `/eventos/{slug}?ref=CODIGO`; atribuição em `Ingresso.promoter_id` na criação do pagamento; painel do organizador com vendas agregadas (sem PII, sem comissão). Compartilhar reutiliza `evento-compartilhar.tsx` com `shareUrl`. Persistência do `ref`: `localStorage` `{codigo,exp}` TTL 24h + `limparRefPromoter` após pagamento; share público remove `?ref=` (`urlCompartilharSemRef`). Isolamento cross-org e atribuição via `POST /pagamentos/criar` cobertos por teste.

**Galeria:** **0–6** fotos reais (`evento_galeria_fotos` / `galeria_urls`) na **criação e edição**; seção “Edições anteriores” só se houver fotos; mesmo pipeline de upload do banner.

Migração: `20260730_000046_carrinho_promoters_galeria.py`. Testes: `test_lembrete_carrinho.py`, `test_evento_promoters.py`, `test_evento_galeria.py`.

### 2.10 Ficha técnica, WhatsApp /contato, duplicar e deletar evento (v1.26)

**Ficha técnica (opcional):** campos `classificacao_etaria` (livre | 12+ | 16+ | 18+), `o_que_levar`, `estacionamento` no criar/editar; página pública (`EventoFichaTecnica`) só mostra o que estiver preenchido — nunca placeholder genérico. Migração `20260731_000047_evento_ficha_tecnica.py`.

**WhatsApp em /contato:** CTA complementar ao formulário via `social_whatsapp_url` das Configurações da plataforma (mesmo campo do rodapé); sem URL configurada o botão não aparece.

**Duplicar:** botão na listagem `/organizador/eventos` chama `POST /api/eventos/id/{id}/duplicar` (já existia); redireciona para editar a cópia; cópia nasce `publicado=false`.

**Deletar:** `DELETE /api/eventos/id/{id}` só para o dono; bloqueado se houver ingresso `pago`, `pendente` ou `usado` (erro sugere despublicar); UI com confirmação explícita; com vendas o botão fica desabilitado com explicação.

Testes: `test_evento_ficha_tecnica.py`, `test_contato_whatsapp_cta.py`, `test_evento_duplicar_deletar.py`.

### 2.11 SEO — metadata por cidade e typicalAgeRange (v1.28)

**Listagem `/eventos`:** `generateMetadata` passa a considerar `?cidade=` (além de `q` e `categoria` já existentes). Só cidade → `Eventos em {cidade} | EventosBR`. Cidade + categoria → combinação natural (`{categoria} em {cidade} | EventosBR`). Casos `q`, só categoria e padrão inalterados. Helper: `frontend/src/lib/eventos-listagem-metadata.ts`.

**JSON-LD Event:** `typicalAgeRange` só se `classificacao_etaria` preenchida — mapeamento schema.org formato aberto `min-`: `livre`→`0-`, `12+`→`12-`, `16+`→`16-`, `18+`→`18-`. Sem classificação o campo some (mesmo padrão de `endDate`). Helper: `typicalAgeRangeFromClassificacao` em `evento-ficha.ts`.

Testes: `tests/test_seo_cidade_typical_age.py` — **sem** `cwd` absoluto (`/workspace`); subprocess herda CWD da raiz do repo (fix `f3f2e8b`).

### 2.18 Home de lançamento — copy e prova social (v1.50–1.50.3)

**Hero (ICP organizador):** marca EventosBR em destaque; uma headline («Venda ingresso hoje. Receba no painel. Opere o dia sem planilha.»); uma frase de apoio; CTAs «Começar meu evento grátis» + «Explorar eventos»; link «Ver página para produtores».

**Visual do hero (v1.50.1 / 1.50.2):** fundo **claro** (branco + verde da marca), foto em `frontend/public/marketing/hero-evento.webp` (+ `.jpg`). **Full-bleed na viewport** só nesta faixa (`data-home-hero-fullbleed` + CSS `:has` no `main`) — resto da home no container `max-w-7xl`. Sem `w-screen` (evita overflow mobile). Imagem atual é **stock** (Unsplash plateia `photo-1501281668745`); substituir no mesmo path.

**Alinhamento (v1.50.3):** hero da home **centralizado no mobile**, à esquerda no `sm+`. Em `/produtores`: título «Venda com a sua marca…» centralizado só no mobile (`sm:text-left`); parágrafo de apoio **justificado**.

**Comprador (secundário):** bloco abaixo do hero — «Do PIX ao QR Code na entrada»; categorias + Como comprar.

**Features:** linguagem humana (sem «Whitelabel»/«Split»); «Sua marca» aponta à página `/produtor`.

**Prova social numérica:** `HomeProvaSocial` só renderiza com volume mínimo (`MIN_EVENTOS=8` **ou** `MIN_INGRESSOS=50`) — evita sinal de plataforma vazia.

**Cenários:** `HomeDepoimentos` vira casos de uso (shows, esportes, comprador) — sem depoimentos fictícios «quem usa recomenda».

**Preços:** «Comece grátis. Pague só quando vender.»

**FAQ:** marca na página pública do produtor (alinhado a §2.17).

### 2.19 Playbook Oficial de Marketing (v1.50.7)

Documento de referência para a equipe produzir conteúdo, anúncios e comunicações com padrão único:

**Arquivo:** `docs/14-playbook-marketing-eventosbr.md` (índice em `docs/README.md`).

| Bloco | Conteúdo |
|-------|----------|
| Posicionamento | Proposta de valor: *A EventosBR simplifica a organização de eventos, da criação da página à venda de ingressos.* Promessa: **Organize melhor. Venda mais.** Frase: *A plataforma para quem organiza eventos.* Marca gramatical: **a EventosBR**. |
| Público | Organizadores (produtores, congressos, workshops, cultura, esportes, empresas, festas/shows, ensino, associações) — não agenda de rolê |
| Tom | Claro, objetivo, profissional, acolhedor; sem exageros sem prova |
| Visual | Logo + assinatura + `eventosbr.app.br` + prints reais + um CTA; cores do produto (`--brand-primary` `#10b981`) |
| Pilares | Organizar · Vender · Profissionalizar · Ensinar |
| Ciclo 1 | Calendário 15 dias (descoberta → consideração → conversão); 7 Reels; carrosséis; Stories; Meta Ads A/B/C |
| CTAs por funil | Topo: Conheça / Descubra / Comece gratuitamente · Meio: Crie / Organize / Publique · Fundo: Criar minha conta / Publicar / Começar agora |
| Canais | Meta Ads, e-mail (3 mensagens), WhatsApp (base própria), SEO/LP de organizador |
| KPIs | Alcance, engajamento, cliques, contas criadas, eventos publicados, custo por cadastro |
| Evolução | Ciclo 2 (performance do organizador) · Ciclo 3 (cases, FAQ, produto) |

**Ops Ads:** IDs Meta Pixel/GTM ainda pendentes de colar no Admin (§7) antes de ligar campanhas.

### 2.20 Documentação técnica fora do site público (v1.50.8)

**Motivo:** `/documentacao`, `/documentacao/api` e `/openapi.json` expunham arquitetura, webhooks, inventário admin e nomes de secrets a anônimos (e indexação via sitemap).

**Mudanças:**

| Item | Antes | Depois |
|------|-------|--------|
| `/documentacao` e `/documentacao/api` | Páginas públicas | Removidas (404) |
| `frontend/public/openapi.json` | Servido estaticamente | Removido do `public/` |
| Export OpenAPI | → `frontend/public/openapi.json` | → `docs/openapi.generated.json` (interno; gitignored) |
| Rodapé | Link «Documentação da API» | Removido |
| `sitemap.ts` | Incluía docs | Sem rotas de documentação |
| `robots.ts` | Allow geral | `Disallow` `/documentacao` e `/openapi.json` |
| E2E smoke | Esperava página de docs | Espera **404** |

Docs operacionais permanecem no **repositório** (`docs/`, `specs/`) — acesso só a quem tem permissão no GitHub (repo privado).

Testes: `tests/test_docs_nao_publicas.py`.

### 2.21 Correções pertinentes da auditoria de lançamento (v1.50.9)

Escopo: itens **necessários/pertinentes** (não o backlog completo de polish UI). Ref: `docs/15-auditoria-lancamento-2026-08.md`.

| Área | Requisito | Implementação |
|------|-----------|---------------|
| UX/API | Sem mensagem Docker/uvicorn ao usuário em produção | `api.ts`: mensagem genérica se `NODE_ENV === "production"` |
| Segurança | Upload não aceita bytes arbitrários se Pillow falhar | `redimensionar_imagem` levanta `ValueError`; callers já mapeiam para 400 |
| UX | Páginas de erro amigáveis | `app/not-found.tsx`, `app/error.tsx` |
| SEO | Sitemap não trava em 100 eventos | `fetchEventosPublicos` com `skip`; `sitemap.ts` pagina até esgotar |
| SEO | Perfil produtor com SSR + metadata | `generateMetadata` + fetch SSR + `initialPerfil` no client |
| SEO | Twitter em página de evento | `twitter` alinhado ao Open Graph em `eventos/[slug]/page.tsx` |
| SEO | robots bloqueia rotas privadas extras | `/cadastro`, `/ingresso/`, `/eventos/novo`, `/eventos/*/editar` |
| Segurança | `migrate_encryption` cobre CPF/TOTP | Campos `asaas_repasse_cpf_cnpj`, `totp_secret` além da API key |
| Dependência | Next.js ≥ 16.3.0 | Bump `frontend` `16.2.6` → `16.3.0` |
| Repo | Ignorar artefato graphify | `**/graphify-out/` no `.gitignore` |

**Fora de escopo (backlog):** contraste zinc-400, `text-[10px]`, `window.confirm`, skeletons admin, touch 44px, CSP no FastAPI (CSP já no Next/`proxy.ts`), enumeração de e-mail no registro.

Testes: `tests/test_imagem_processamento.py`, `tests/test_secret_storage.py`, `tests/test_auditoria_lancamento_v1509.py`, E2E smoke (404 docs mantido).

### 2.13 Lançamento comercial — home dual, Ads e SEO (v1.47)

**Home (histórico v1.47; substituído em parte por §2.18):** separação comprador × organizador. `HomeProdutorFeatures`, `HomeFaq`, vitrine e diferenciais do comprador.

**Cards vitrine:** cidade no meta; CTA explícito «Comprar ingresso» / «Ver evento».

**Wizard criar evento:** indicador «Etapa {n} de 3» em `WizardBar`.

**Copy marketing:** `/funcionalidades` e `/sobre` sem jargon técnico (FastAPI/OpenAPI) na comunicação comercial; novos blocos financeiro/relatórios/whitelabel em funcionalidades.

**SEO:** JSON-LD `Organization` no root layout; `og-image.png` e placeholders `/marketing/*.webp`; `robots: noindex` em layouts `/organizador` e `/conta`.

**Ads (Facebook / Instagram):** Meta Pixel + GTM — scripts só em produção (`marketing-analytics.tsx`). IDs configuráveis em **Admin → Configurações da plataforma** (`meta_pixel_id`, `gtm_id` em `platform_settings`; migração `20260802_000049`); fallback `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GTM_ID` no build. Eventos: `ViewContent` (página evento), `InitiateCheckout` (reserva checkout), `Purchase` (`?compra=ok`), `CompleteRegistration` (cadastro), `Lead` (contato). `setMarketingRuntimeIds` prioriza IDs do painel.

Testes: `tests/test_marketing_lancamento.py`, `tests/test_home_posicionamento.py`, `tests/test_platform_marketing_ids.py`.

### 2.14 Pixel/GTM no admin (v1.47.1)

**Objetivo:** configurar campanhas Ads sem editar `.env` no servidor — colar Pixel ID e GTM no painel admin.

**Backend:** colunas `meta_pixel_id`, `gtm_id` em `platform_settings`; validação `normalizar_meta_pixel_id` / `normalizar_gtm_id`; exposto em `/api/public/platform` e PATCH `/api/admin/settings`.

**Frontend:** seção «Marketing / anúncios» em `admin-platform-settings.tsx`; `MarketingAnalytics` + `trackAnalyticsEvent` leem IDs via `usePlatformSettings()` (DB > env).

### 2.16 UX admin, whitelabel e contato (v1.48)

**Cadastro:** e-mail duplicado → `400` com «Email já cadastrado, faça login ou recupere sua senha»; UI com links para login e recuperação.

**Admin → Configurações:** tamanho recomendado em cada imagem (`ImagemAssetField`); paleta de cores preset + cor escura automática (`BrandColorPicker`); telefone com máscara BR.

**Whitelabel organizador:** mesma paleta de cores em `perfil-publico-organizador.tsx` (página `/organizador/whitelabel`).

**Admin → Usuários:** editar nome, e-mail e telefone (`PATCH /api/admin/usuarios/{id}` + modal).

**PDV:** mensagem de sucesso «Compra realizada! Ingresso enviado…»; telefone com máscara.

**Contato:** título «Contato» centralizado; texto intro justificado.

**Marketing:** assets `/public/marketing/*.webp` (script `generate_marketing_png.py`) em `/funcionalidades` e `/produtores` via `MarketingScreenshot` (`<img>` direto, sem `next/image`).

**Navbar:** `lg+` (≥1024px) menu em **uma linha** (logo, busca, links incluindo Sobre, login/conta); `md–lg` (768–1023) duas linhas (logo+conta / busca+links); celular usa menu ☰. Dropdowns **Categorias** e **conta** via `createPortal` (`z-80`, `position: fixed`) — nunca dentro de `overflow-x-auto`. Links com `inline-flex items-center`. Menu da conta: um portal único.

**Navbar layout (v1.50.4 / 1.50.6):** em `lg+`, links **sem** `flex-1` e **`shrink-0`** (Sobre não some no overflow). Sequência: logo → busca (pode encolher) → links → separador → auth. CTA «Crie um evento» e **nome do usuário** no chip da conta permanecem como na v1.50.4 — **não** compactar ao logar.

**Telefone:** componente `TelefoneInput` — máscara BR em campos que faltavam (admin config, PDV, whitelabel).

### 2.17 Tema de marca proporcional + navbar (v1.49 → v1.49.1)

**Dois escopos distintos:**

| Origem | Onde aplica | Como |
|--------|-------------|------|
| **Admin → Configurações** (plataforma) | Site inteiro | Escala `--brand-50`…`950` em `:root` / `<html>` (`PlatformTheme` + `PlatformThemeLive` + SSR no `layout.tsx`) |
| **Whitelabel organizador** (`/organizador/whitelabel`) | **Somente** `/produtor/[slug]` | Escopo CSS `.eventosbr-organizer-scope` — **não** altera home, admin nem página do evento |

**Derivação:** `brand-color-palette.ts` — `generateBrandScale(primary, dark)` (600 = primária, 700 = escura; restante HSL).

**Remapeamento:** `globals.css` `@theme` — `--color-emerald-*` → `var(--brand-*)` (paleta da plataforma).

**Atualização ao vivo (plataforma):** `applyBrandThemeToDocument` + `replaceSettings`/`patchSettings` + `BroadcastChannel` — ao salvar/preset no admin, sem reload; outras abas sincronizam.

**Navbar (v1.49.1 / v1.50.4):**
- Links numa sequência contínua (`PrimaryNavLinks`) — sem `overflow-hidden` que escondia itens.
- v1.50.4: sem `flex-1` nos links em `lg+`; auth agrupado após os links (não flutuando só na borda direita).
- Dropdown Categorias / menu conta via `createPortal` (`z-80`).
- Busca: `NavbarSearchForm` **fora** do corpo do `Navbar` (evita remount e perda de foco ao digitar).

**API:** `organizador_brand_*` no `EventoResponse` (metadados); página `/eventos/[slug]` **não** injeta tema do organizador.

### 2.15 Admin — configurações UX (v1.47.2)

**Problema:** campos do admin usavam classe `.input` sem estilo global — bordas invisíveis.

**Correção:** `.input` em `globals.css` (borda `zinc-300`, foco emerald). Painel admin reorganizado: seções com título + hint curto; «Marca visual» objetiva (`ImagemAssetField` `compact` omite texto longo de dimensões); mensagem de sucesso enxuta.

### 2.12 PDV presencial + assentos nomeados (MVP, v1.34; e-mail obrigatório desde v1.36)

Duas funcionalidades classificadas como alto esforço na pesquisa de concorrentes — entregues como **MVP**, sem a versão completa.

#### PDV / venda presencial

- Rota UI: `/organizador/eventos/{id}/pdv` (link “PDV” na listagem do organizador).
- API: `POST /api/eventos/id/{evento_id}/pdv` — só o dono (`_evento_do_organizador`).
- Formulário: nome e e-mail (**obrigatórios**), telefone (opcional), lote, forma de pagamento textual (`dinheiro` | `pix_manual` | `cartao`), assento se o lote tiver lista.
- **E-mail obrigatório (v1.36):** no PDV o ingresso vai para a **conta cliente** criada/reaproveitada pelo e-mail informado (`usuario_id` do comprador — v1.39). Backend rejeita venda sem e-mail válido; UI marca o campo como obrigatório.
- **Confirmação de e-mail (v1.42):** campo “Confirme o e-mail” na UI — venda bloqueada se não coincidir; após venda, feedback com destino e status de envio (`email_enviado_sync`).
- **Envio na venda (v1.42):** `send_ticket_email_sync` tenta SMTP imediato; se falha, `enqueue_ticket_email` (fila confiável). Comprador deve conferir o celular na hora.
- **Correção de venda (v1.42):** seção “Corrigir venda” no PDV — busca ingressos **do evento** (só dono) por nome, e-mail, telefone ou CPF (`ingresso_busca` + telefone); APIs:
  - `GET /api/eventos/id/{evento_id}/pdv/vendas/buscar?q=`
  - `PATCH /api/eventos/id/{evento_id}/pdv/vendas/{ingresso_id}`
  - `POST /api/eventos/id/{evento_id}/pdv/vendas/{ingresso_id}/reenviar-email`
  Atualiza participante e **reatribui `usuario_id`** à conta do e-mail certo (`conta_cliente`); rate limit `pdv_reenviar` no reenvio. Log de auditoria em `pdv_correcao.py`. **Sem busca pública** — só organizador do evento.
- **Self-service comprador (v1.43):** em **Minha conta → Ingressos**, o comprador pode **vincular ingresso** com o código da carteirinha/e-mail (`POST /api/ingressos/vincular`, rate limit `ingresso_vincular`). Só ingressos `pago`/`usado`; exige que o e-mail da conta logada coincida com `participante_email`. Serviço: `ingresso_vincular.py`. Testes: `test_ingresso_vincular.py`.
- Gera `Ingresso` com `status=pago`, `canal_venda=pdv`, `forma_pagamento_pdv` — **sem Asaas, sem split, sem repasse automático** (reconciliação manual).
- Respeita `quantidade_maxima` do lote (via `reservar_vaga_e_assento` / FOR UPDATE).
- Carteirinha/QR: mesmo fluxo (`codigo_checkin` → `/ingresso/qr?c=…`); e-mail com carteirinha via `send_ticket_email_sync` + fallback fila.
- **Fora de escopo:** maquininha, split/NF automática, UI só-tablet.

#### Assentos nomeados (sem mapa visual)

- Campo opcional no lote: texto `A1, A2, B1` → coluna `evento_ingresso_lotes.assentos`; parse em `app/utils/lote_assentos.py`.
- Checkout: se o lote tem assentos, select de assento disponível (qty=1); lote sem assentos continua por quantidade.
- Claim atômico: `SELECT FOR UPDATE` no lote + checagem de ocupação (`app/services/lote_assentos.py`), mesmo espírito do claim do carrinho.
- Assento em `Ingresso.assento` → carteirinha PNG, e-mail, download HTML, `/ingresso/qr`, relatório de participantes, painel (PDV + editor de lotes mostra ocupados).
- **Fora de escopo:** mapa clicável, editor de planta, preços por setor.

Migração: `20260731_000048_pdv_assentos_mvp.py` (`assentos` no lote; `assento`, `canal_venda`, `forma_pagamento_pdv` no ingresso). Validada upgrade→downgrade→upgrade contra Postgres real.

Testes: `tests/test_pdv_presencial.py`, `tests/test_pdv_correcao_email.py`, `tests/test_lote_assentos.py` (auth dono, limite de lote, race de assento, carteirinha, correção de e-mail + reassociação de conta, busca por telefone, reenvio).

**Achado da supervisão (importante, primeiro teste de concorrência real do sistema):** `test_dois_compradores_mesmo_assento_so_um_consegue` falhava — as duas threads conseguiam o mesmo assento — não porque o código de trava estivesse errado, mas porque a suíte inteira roda em SQLite em memória (`tests/test_api.py`, `StaticPool`), e o dialeto SQLite do SQLAlchemy **descarta silenciosamente a cláusula `FOR UPDATE`** (sem suporte a lock de linha). Rodado 5x contra Postgres real, a mesma lógica passa consistentemente — o código de produção está correto, só a verificação por SQLite não conseguia detectar isso (nem detectaria um bug de verdade, se houvesse). Corrigido: fixture `db_postgres_real` troca `get_db` temporariamente pra um Postgres real só durante esse teste (via `DATABASE_URL_TESTE_CONCORRENCIA`; pula com aviso se não configurada — nunca dá falsa confiança). CI (`ci.yml`) ganhou serviço Postgres pra essa variável ficar sempre disponível lá. Isso também expõe que a trava pré-existente de capacidade de lote (`reservar_vaga_lote`, usada há mais tempo) nunca tinha sido verificada sob concorrência real antes.

### 2.2 Conta de recebimento do organizador (modelo `baas` — alvo futuro)

> **Isto descreve o modelo `baas` (alvo, quando houver CNPJ da conta mãe).** No lançamento atual (`linked`), o organizador **cria/vincula a própria conta Asaas** (fora do EventosBR) — fluxo completo em `specs/onboarding-linked-lancamento.md`. As seções abaixo (KYC, split, saque) continuam válidas em ambos os modos.

Em `baas`, o organizador não cria nem vincula conta em painel externo — tudo ocorre dentro do EventosBR:

1. Organizador → **Financeiro** → **Criar conta de recebimento**.
2. Formulário na plataforma (CPF/CNPJ, endereço, telefone, renda, data de nascimento quando PF).
3. Backend provisiona a **conta de recebimento** do organizador (PF ou PJ) via API do processador (`POST /v3/accounts` — rota pública `POST /api/organizador/asaas/conta-recebimento`; alias legado `/asaas/subconta`).
4. KYC/análise → status `approved` libera publicação e venda.
5. Repasses caem na conta de recebimento do organizador via split; **saques Pix** são solicitados na plataforma (white-label).
6. Extrato, vendas e conciliação na área **Financeiro** do organizador.

**Conta mãe da plataforma (operação):** a chave `ASAAS_API_KEY` do EventosBR deve pertencer a uma conta **pessoa jurídica (CNPJ)** no processador. Sem isso, o provisionamento de contas de recebimento dos organizadores é bloqueado pelo processador (limitação BaaS). Organizadores podem ser **PF (CPF)** ou **PJ (CNPJ)** — o bloqueio não é do CPF do organizador, e sim da conta mãe da plataforma.

**Terminologia (UX e spec):** usar sempre **conta de recebimento** ou **conta de repasses**. Não expor “subconta”, “Asaas” nem “vincular wallet” ao usuário.

**Acompanhamento dinâmico (tracker):** após criar conta ou iniciar assinatura, UI exibe stepper com polling (`GET /api/organizador/onboarding/conta/{trackingId}/status` e `GET /api/organizador/onboarding/assinatura/{subscriptionId}/status`, intervalo ~4s). E-mails automáticos no backend em `APPROVED`/`REJECTED` (conta) e `SUBSCRIBED`/`PAYMENT_FAILED` (assinatura). Componente reutilizável: `frontend/src/components/status-tracker.tsx`.

**Modo de produção (decisão 02/08/2026):** `ASAAS_ONBOARDING_MODE=linked` — o organizador **abre o Asaas**, cria ou vincula a própria conta e completa os dados/KYC no painel do processador (link de cadastro EventosBR ou walletId). **Não** alterar para `baas` até existir CNPJ na conta mãe da plataforma; a migração futura é só `ASAAS_ONBOARDING_MODE=baas` (ou `both`) no `.env`, sem mudança de código — ver `specs/onboarding-linked-lancamento.md`. Ativo em produção desde 25/07/2026.

### 2.3 Configuração Asaas — somente produção

Em **produção** (`ENVIRONMENT=production`):

| Variável | Valor fixo | Observação |
|----------|------------|------------|
| `ASAAS_ENVIRONMENT` | `production` | Chaves `$aact_prod_...`; **não alterar** |
| `ASAAS_ONBOARDING_MODE` | `linked` (lançamento) / `baas` (alvo) | Hoje: organizador vincula conta própria. `baas` (conta criada pela plataforma) fica pra quando houver CNPJ da conta mãe |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` | Sem colar walletId manualmente |
| `ASAAS_DISABLED` | `false` | Pagamentos reais ativos |

A conta Asaas vinculada a `ASAAS_API_KEY` deve ser **CNPJ** (conta mãe da plataforma) para provisionar contas de recebimento dos organizadores **quando o modo for `baas`/`both`**. Em `linked` (modo de lançamento atual), essa exigência não se aplica — cada organizador vincula a própria conta Asaas. Verificação: `GET /api/admin/setup` → `checks.asaas_platform_cnpj`.

Credenciais Asaas (`ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`) são de **produção**, configuradas uma vez no `.env` do VPS e **não devem ser trocadas** em operação normal. Backups: `backup-prod-env.sh` / `restore-prod-env.sh`.

`config/settings.py` → com `ENVIRONMENT=production`, `asaas_env()` retorna sempre `production` (sem inferência sandbox).

`linked` é o modo de lançamento atual (organizador vincula conta própria); `both` aceita ambos os fluxos simultaneamente (compatibilidade); `baas` é o alvo quando houver CNPJ da conta mãe.

### 2.4 Status que liberam venda

`app/services/evento_repasse.py` (`status_repasse_aprovados()`) → **`approved`** sempre; **`linked`** também libera quando `settings.permite_vinculo_wallet_organizador()` (modo de lançamento atual, `ASAAS_ONBOARDING_MODE=linked`); **`manual`** só libera com a flag `ASAAS_ALLOW_MANUAL_WALLET` (dev/teste — `false` em produção).

### 2.5 Checkout e assinatura

- Checkout bloqueado sem conta de recebimento aprovada.
- Webhooks `PAYMENT_*` marcam `pago_em`.
- Assinatura mensal: 100% plataforma, sem split de ingresso; reutiliza PIX pendente.

### 2.6 Webhooks (produção)

- URL: `https://eventosbr.app.br/api/webhooks/asaas`
- Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`
- Pagamentos: `PAYMENT_*`
- Conta de recebimento / saques: `ACCOUNT_STATUS_*`
- Autorização de transferência Pix: `https://eventosbr.app.br/api/webhooks/asaas/transfer-auth`

### 2.6.1 Incidente resolvido: token do webhook dessincronizado (2026-07-28)

`ASAAS_WEBHOOK_TOKEN` no `.env` da VPS ficou diferente do token cadastrado no
painel do Asaas (Integrações → Webhooks → campo "Token de autenticação") —
webhook penalizado, todos os eventos retornando 401 "Invalid token" por horas.
**Os dois valores precisam ser idênticos manualmente** — não há sincronização
automática entre o `.env` e a configuração do painel Asaas. Se o token for
regenerado de um lado, precisa ser copiado pro outro. Diagnóstico rápido:
`grep ASAAS_WEBHOOK_TOKEN .env` na VPS vs. o campo no painel Asaas.

### 2.6.2 Filas de e-mail — confiabilidade (adicionado v1.12)

Dois bugs reais corrigidos em `ticket_email.py` e `notificacao_email.py`
(e-mail de ingresso e e-mail simples — onboarding/saque/lista de espera/lista
de interesse): a API sempre respondia "enfileirado com sucesso", mas o
e-mail podia nunca chegar.

1. **`notificacao_email.py` — bug mais grave**: `blpop` + `.decode()` no
   resultado, mas o cliente Redis usa `decode_responses=True` (já devolve
   `str`, não `bytes`) — `.decode()` numa string levanta `AttributeError`,
   capturada pelo `except` genérico do worker, e o payload (já removido da
   fila por `blpop`, que é destrutivo) se perdia **em toda mensagem**
   enfileirada via Redis por esse serviço.
2. **`ticket_email.py`**: `brpop` remove o item da fila assim que retirado —
   se o container da API reiniciar (deploy) no meio do envio SMTP, o item já
   saiu da fila e não tem como recuperar.

**Correção (mesmo padrão nos dois arquivos):** `blpop`/`brpop` (destrutivo)
trocado por `blmove` movendo pra uma lista `...processing` — só sai de lá
quando o envio termina de fato. Ao iniciar o worker, itens deixados em
`processing` por um processo anterior que morreu no meio são devolvidos pra
fila principal. `start_*_worker()` passa a checar `thread.is_alive()` (não só
uma flag booleana) — antes, se a thread morresse por qualquer motivo, o
worker nunca mais reiniciava. `stop_*_worker()` agora espera (join, até 25s)
o envio em andamento terminar antes do processo sair, em vez de matar a
thread na hora — relevante porque deploys da API são frequentes.

### 2.6.3 SMTP: SSL/fallback + persistência do contato (v1.13)

Incorporado seletivamente de um branch paralelo (nunca mergeado) que
trabalhava no mesmo problema — só as partes que não conflitam com 2.6.2:

- `smtp_client.py`: suporte a SSL implícito (porta 465, comum na Hostinger)
  além de STARTTLS (587); tenta até 3 modos de conexão em sequência se o
  configurado falhar; parâmetro `reply_to` (contato do site responde pro
  visitante, não pra própria plataforma)
- **Bug real corrigido** em `env-file-lib.sh`/`bootstrap-vps-env.sh`: valores
  com `#`, espaço, `$` ou aspas (comuns em senhas fortes) agora são gravados
  entre aspas no `.env` — sem isso, o Docker Compose trunca o valor no
  primeiro `#`, cortando a senha silenciosamente
- `/contato`: mensagem sempre salva no banco (`ContatoSiteMensagem`) **antes**
  de tentar enviar o e-mail — se o SMTP falhar, a mensagem não se perde
  (`email_enviado=false`, visível via `GET /api/admin/contato/mensagens`)
- ⚠️ Durante essa incorporação, encontrada senha real de e-mail exposta como
  exemplo num script daquele branch paralelo (já publicado no GitHub,
  mesmo sem merge) — recomendado rotacionar `EMAIL_PASSWORD`.

### 2.6.4 Contato: envio de e-mail assíncrono (v1.13)

A rota `/contato` chamava `send_email()` de forma **síncrona**, dentro da
própria requisição HTTP — com até 3 modos de fallback de 30s cada, a tela do
formulário podia ficar travada por quase 90s se o SMTP estivesse
lento/inacessível. Corrigido com uma fila confiável dedicada
(`app/services/contato_email.py`, mesmo padrão de 2.6.2: `blmove` +
lista `processing` + recuperação de órfãos) — a rota agora salva e enfileira
(responde na hora), o envio de verdade acontece em segundo plano e o worker
atualiza `email_enviado` no banco quando termina. Validado com teste de
tempo real (resposta em menos de 1s, contra até ~90s antes).

### 2.6.5 Contato: confirmação ao remetente + causa raiz do e-mail não chegar (v1.14)

- `contato_email.py`: depois do e-mail interno (pra plataforma) ser enviado
  com sucesso, dispara um segundo e-mail pro próprio remetente confirmando o
  recebimento ("recebemos sua mensagem, vamos responder em breve"). Falha
  nessa confirmação não afeta o resultado do envio principal (best-effort).
- Formulário `/contato`: mensagem na tela simplificada pra "Mensagem enviada
  com sucesso!" (o detalhe completo vai só no e-mail de confirmação).
- **Causa raiz real do e-mail nunca chegar** (incidente de produção,
  resolvido): `EMAIL_USER` no `.env` estava `noreply@eventosbr.app.br`, mas a
  senha configurada em `EMAIL_PASSWORD` era da caixa `contato@eventosbr.app.br`
  — usuário e senha de contas diferentes, autenticação SMTP sempre rejeitada
  (`535 authentication failed`). Corrigido alinhando `EMAIL_USER` com a caixa
  cuja senha está de fato configurada. Lição: `EMAIL_USER`/`EMAIL_PASSWORD`
  precisam ser da **mesma caixa de e-mail** — o serviço já tenta múltiplos
  modos de conexão (SSL/STARTTLS) automaticamente, mas nenhum deles ajuda se
  as credenciais forem de contas diferentes.

### 2.6.6 SMTP unificado em todos os fluxos de e-mail (v1.16)

**Bug real corrigido**: apenas `contato_email.py` usava o cliente SMTP compartilhado
(`smtp_client.py`, com fallback SSL 465/STARTTLS 587 — ver 2.6.3). `ticket_email.py`
(ingresso), `notificacao_email.py` (onboarding/saque/listas), `lembrete_evento.py`,
`assinatura_email.py` e `marketing_email.py` ainda abriam conexão `smtplib.SMTP` direta,
sem o fallback — nesses fluxos, um SMTP configurado só para SSL implícito (porta 465,
comum na Hostinger) falhava silenciosamente, enquanto `/contato` funcionava normalmente.

**Correção**: `smtp_client.py` ganhou `send_prebuilt_message()` — mesma lógica de
fallback de `send_email()`, mas aceita uma mensagem MIME já montada pelo chamador
(necessário para o e-mail de ingresso, que anexa a imagem inline do QR code). Todos
os cinco arquivos acima foram migrados para usar `smtp_client` (`send_email()` ou
`send_prebuilt_message()`), eliminando toda chamada direta a `smtplib` fora do
próprio `smtp_client.py`.

**Também corrigido nesta versão**: workers de `notificacao_email.py`
(`start_email_simples_worker()`) e `contato_email.py` (`start_contato_email_worker()`)
agora iniciam no boot da API (`app/main.py`), igual a `ticket_email.py` — antes só o
worker de ingresso iniciava eagerly; os outros dois só começavam a rodar (e a recuperar
órfãos da lista `processing`) no primeiro e-mail enfileirado depois do deploy.

### 2.7 Testes automatizados (código — não cobram de verdade)

```bash
# Local — suite completa
python3 -m pytest -q

# Local — split mock
python3 -m pytest tests/test_compra_split_fluxo_mock.py -v

# VPS (pytest dentro do container)
bash scripts/test-compra-split-mock.sh

# Frontend
cd frontend && npm run build
cd frontend && npm run test:e2e          # smoke + patamar (sem API)
```

Valida: compra PIX mock → webhook → ingresso pago → split só no wallet do organizador (não da plataforma).

**CI** (`.github/workflows/ci.yml`):

| Job | O que valida |
|-----|----------------|
| `api` | `pytest` (**470** testes) — job roda com serviço Redis (`redis:7-alpine`) desde v1.16, senão os testes de fila confiável (`test_fila_email_*_confiavel.py`) falham por falta de Redis |
| `web` | `npm run build` |
| `e2e` | Playwright smoke + patamar **sem API** (`PLAYWRIGHT_SKIP_API_CHECK=1`) |
| `e2e-compra` | Stack Docker + compra mock + patamar com API (lista interesse, espera, produtor, perfil organizador) |
| `e2e-asaas` | Checkout PIX/cartão mock Asaas |
| `prod-compose` | `docker-compose.prod.yml` válido |

Conectividade API real (produção): `scripts/test-asaas-connection.py`.

### 2.8 Validação operacional (VPS — cobra de verdade)

Procedimentos para marcar os critérios §7 como concluídos **após deploy em produção**:

#### A) Webhook real (`PAYMENT_RECEIVED`)

1. Painel Asaas → Integrações → Webhooks → URL `https://eventosbr.app.br/api/webhooks/asaas`
2. Token = `ASAAS_WEBHOOK_TOKEN` do `.env` (header `asaas-access-token`)
3. Eventos: `PAYMENT_*`, `ACCOUNT_STATUS_*`
4. No VPS: `bash scripts/test-asaas-webhook.sh --expect-ok` (valida token e URL)
5. Realizar compra de teste (PIX ou cartão) e confirmar no log da API que `PAYMENT_RECEIVED` atualizou `pago_em`

**Script (pré-check automatizado):** `bash scripts/validar-go-live-vps.sh --webhook-only`

#### B) SMTP + SPF/DKIM

1. Confirmar `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_SERVER` no `.env`
2. Compra de teste → e-mail de ingresso recebido na caixa de entrada (não spam)
3. Validar SPF/DKIM do domínio remetente (painel DNS / ferramenta do provedor)

#### C) Primeira venda real

1. Organizador com conta de recebimento `approved`
2. Evento publicado com ingresso pago
3. Compra PIX ou cartão concluída
4. Ingresso com QR na conta do comprador + e-mail recebido
5. Split visível no extrato Financeiro do organizador

**Status:** [x] validado em produção (02/08/2026, usuário).

---

## 3. UX — Área da conta

- `ContaShell` em `/conta/*`: menu lateral **Perfil**, **Pagamentos**, **Ingressos**, **Notificações** (cliente).
- Dropdown do avatar: **Painel** (só organizador), **Perfil**, **Sair**. Pagamentos, Ingressos e Notificações ficam nas abas do perfil (`PerfilTabs`), não no dropdown.
- Organizador logado: dropdown **Perfil** → `/organizador/perfil`; subpáginas via abas horizontais (`/pagamentos`, `/ingressos`, `/notificacoes`), renderizando os mesmos clients de `/conta/*` dentro do `OrganizadorShell` — a barra lateral **Painel** não muda.
- Abas horizontais do perfil do organizador via `PerfilTabs` (`frontend/src/components/perfil-tabs.tsx`), renderizadas abaixo do título em cada página `/organizador/perfil/*` (Perfil · Pagamentos · Ingressos · Notificações). O `layout.tsx` do perfil é passthrough.
- `auth/layout.tsx` + `layout.tsx`: rodapé fixo no fim da viewport — shell estável (`grid` `auto 1fr auto`), CSS crítico `eventosbr-shell-layout`, `EarlyScrollReset` no `<head>`. Validação: `scripts/verificar-versao-site.sh`.
- Máscaras: CPF/CNPJ, CEP, telefone nos formulários financeiro, checkout e repasse de ingresso.
- **White-label:** mensagens ao usuário não expõem o processador de pagamentos:
  - `api-errors.ts` e `mensagens_publicas.py` — sanitização de erros API
  - `organizador-repasses-painel.tsx` — copy “conta de recebimento/repasses”
  - `documentacao/page.tsx` e `documentacao/api/page.tsx` — sem `wallet_id`, paths sanitizados na UI
  - `scripts/export-openapi.py` — summaries/descriptions sem marca do provedor em `openapi.json`
    (**bug corrigido v1.16**: `_sanitizar_paths()` copiava o corpo de cada operação —
    summary, description, requestBody, responses — sem chamar `_sanitizar_schema()`
    nele, então o texto nunca era sanitizado apesar da função existir; `openapi.json`
    exportado continuava com "Asaas Iniciar Cobranca" etc. Corrigido chamando
    `_sanitizar_schema(spec)` em cada operação, sanitizando também `operationId`, e
    renomeando definições de schema com a marca — `AsaasCobrancaRequest` →
    `PagamentosCobrancaRequest` — com atualização de todos os `$ref`. Regressão coberta
    por `tests/test_export_openapi_white_label.py`.)

### 3.1 Menu unificado + conversão cliente → organizador (adicionado v1.11)

- **Navbar** (`components/navbar.tsx`): cliente, organizador e deslogado veem o **mesmo menu completo** (Funcionalidades, Planos, Eventos, Categorias, Sobre) — antes cliente via só "Eventos", escondendo o caminho para virar organizador.
- **`POST /api/auth/tornar-organizador`**: converte conta `cliente` → `organizador` sem criar conta nova (mantém histórico de compras). Exige confirmar/informar telefone. Bloqueado se a conta já for organizador. Limpa o cookie de cache do middleware (`eventosbr_session_ok`) na hora, pra `/organizador/*` liberar sem esperar o TTL de 5 min.
- **`TornarOrganizadorCard`** (`components/tornar-organizador-card.tsx`): card "Crie o seu próprio evento" em `/conta/perfil`, visível só para `tipo=cliente`. Pode abrir automaticamente via `?tornar_organizador=1`.
- Duas rotas que antes **deslogavam** um cliente tentando acessar área de organizador (assumindo que os tipos nunca se convertiam) foram corrigidas para redirecionar (sem deslogar) para o fluxo de conversão: `novo-evento-gate.tsx` (`/eventos/novo`) e `destinoPosAuth` (usado por `/cadastro` e páginas de auth com `?next=/organizador/*`).

### 3.3 Cadastro organizador — confirmação de e-mail (v1.45 / UX v1.46)

- `POST /api/auth/registrar` com `tipo=organizador`: **não autentica** até confirmar e-mail; resposta `pending_email_verification` + `email` + `message`.
- E-mail de **boas-vindas** com botão «Ativar minha conta» e link em texto para copiar/colar; validade **24h** (`ORGANIZADOR_VERIFICACAO_HORAS`).
- `POST /api/auth/verificar-email` confirma token e **autentica** (cookie) se a conta tem senha.
- Login bloqueado (`403`) para organizador com `email_verificado=false`.
- `POST /api/auth/reenviar-verificacao-cadastro` (público, rate limit + Turnstile) reenvia para cadastro pendente.
- UI **pública** após cadastro (`/cadastro` ou `/auth`): tela dedicada **«Conta criada»** com e-mail cadastrado em destaque, **sem login** e **sem** redirecionar ao painel — componente `organizador-cadastro-pendente.tsx`; URL `?confirmar=1` + `sessionStorage` para persistir após refresh; reenvio e link «Já confirmou? Fazer login».
- `/auth/verificar-email` redireciona organizador ao painel após clicar o link do e-mail.
- Cliente e compra rápida mantêm fluxo anterior (48h compra rápida; cliente `email_verificado=true` no registro).

### 3.2 Correções de roteamento e painel admin (v1.14)

- **Bug real**: `/contato` era tratado como rota protegida — a checagem usava
  `pathname.startsWith("/conta")` puro, e `/contato` **também começa com essas
  letras** ("conta" + "to", coincidência de string, não de rota). Visitante
  deslogado clicando em "Fale conosco" caía em `/auth?next=/contato`. Corrigido
  em dois lugares (`proxy.ts` middleware e `lib/api.ts` redirecionamento de
  sessão expirada) com checagem de limite de segmento:
  `pathname === "/conta" || pathname.startsWith("/conta/")`.

### 3.2.1 Sessão expirada → login (v1.47.4)

**Bug:** ao expirar a sessão (cookie inválido ou 401 na API), o organizador era redirecionado a `/cadastro` em vez de `/auth` — em especial em `/organizador/novo` ou com `mode=register` na query.

**Correção:**

- Middleware (`proxy.ts`): cookie `eventosbr_session_expired` (300s) ao invalidar sessão; com marcador ou `expirado=1` → **`/auth?login=1&expirado=1&next=…`** (nunca `/cadastro`); visitante novo sem marcador em `/organizador/novo` continua em `/cadastro`.
- Cliente (`lib/api.ts`): 401 em área protegida limpa cache, marca cookie e redireciona a `/auth` com `login=1`.
- `auth-client.tsx`: modo **login** forçado quando `expirado=1`; não redireciona com cache stale se sessão expirada.

Testes: `tests/test_sessao_expirada_redirect.py`; E2E patamar «marcador sessão expirada».

- **Destino pós-login**: revertida a prioridade de `/admin/dashboard` para
  contas `is_platform_admin` — volta a ser `/organizador/eventos` (organizador)
  ou `/` (cliente) sempre; o acesso ao admin é via item "Administração" do
  menu, não destino automático.
- **`/admin/dashboard` não tinha menu lateral**: fica fora das árvores
  `/organizador/*` e `/conta/*` — ao clicar em "Administração", o menu lateral
  inteiro desaparecia (mesmo padrão do bug já corrigido em
  `/eventos/[slug]/editar`). Corrigido com `AdminShellWrapper`
  (`components/admin-shell-wrapper.tsx`) — escolhe `OrganizadorShell` ou
  `ContaShell` conforme o tipo da conta logada, envolvendo `admin/layout.tsx`.
- **Flash da tela "colar chave"**: `authed` começava em `false`, então essa
  tela sempre renderizava primeiro, mesmo pra quem já tem acesso via login
  normal — só depois da checagem assíncrona (`adminSessionInfo()`) resolver é
  que o dashboard de verdade aparecia. Corrigido com um estado
  `checandoSessao` (carregando neutro) no meio-tempo.

---

## 4. UX — Produto (checklist publicação)

| # | Requisito | Status |
|---|-----------|--------|
| P1 | Logo, hero, diferenciais, busca navbar, footer profissional | [x] |
| P2 | Checkout all-in sem marca do gateway; badges PIX/cartão/seguro | [x] |
| P3 | Vitrine: filtros data, mapa evento, urgência, relacionados | [x] |
| P4 | Planos unificados, simuladores organizador/comprador | [x] |
| P5 | Parcelamento 2/3/6/12x; lista interesse e espera | [x] |
| P6 | Página pública organizador `/produtor/{slug}` | [x] |
| P7 | Central `/ajuda`, blog, documentação API | [x] |
| P8 | Wizard evento 3 passos, checklist publicação, tour organizador | [x] |
| P9 | Portaria: QR local, feedback som/vibração, rate limit | [x] |
| P10 | SEO: sitemap dinâmico (inclui páginas de evento), robots, metadata, JSON-LD `Event` + `BreadcrumbList`, canonical por página, OG image padrão | [x] |
| P11 | Formulários de auth: `autoComplete` correto, indicador de força de senha no cadastro | [x] |
| P12 | Contato/telefone obrigatórios na criação de evento; e-mail/telefone/redes sociais configuráveis nas Configurações da plataforma (admin) | [x] |
| P13 | Formulário público "Fale conosco" (`/contato`), com Turnstile + rate limit | [x] |
| P14 | Upload de imagem (logo/favicon/capa de evento) comprimido/redimensionado no navegador **e** no servidor (Pillow) — nunca amplia, preserva transparência | [x] |
| P15 | Rodapé: contato + redes sociais agrupados à direita; botão flutuante de voltar ao topo | [x] |
| P16 | Mapa da página de evento sempre embutido (iframe), sem depender de chave de API do Google Maps configurada — usa `?output=embed` como padrão | [x] |
| P17 | Página pública do evento sem informação repetitiva: meta única (quando/onde), preço/lote/urgência só na zona de compra (sticky), Sobre só com descrição; prova social “X pessoas…”, barra de restante do lote, compartilhar WhatsApp + copiar link | [x] |
| P18 | Organizador (nome/e-mail/telefone) visível na página do evento; "Ler descrição completa" não duplica mais o início do texto; link "Fale conosco" da página do evento vai pro formulário de contato de verdade (não mais pra /sobre); e-mail do ingresso traz uma carteirinha completa (nome/evento/data/local + QR), não mais um QR nu sem contexto | [x] |

**Nota v1.17 (P17)**: implementado após análise de mercado (Diversos Ingressos, AppTicket,
Guichê Web, Uticket, PagTickets, G-ticket, Sympla, etc.). Removidos o bloco
`EventoResumoRapido` e a ficha Início/Local/Ingresso/Lotes do “Sobre”. Hero/meta
não mostra mais preço. Reembolso aparece só na zona de compra (não duplicado no
bloco de confiança). Ver `specs/proposta-melhorias-pagina-evento.md`.

**Nota v1.16 sobre P16**: entre a v1.15 e este `/review`, um commit (`03883b5`) havia
revertido esse comportamento por precaução (achando que o Google bloqueava o embed sem
chave) — o fallback `?output=embed` sem chave voltou a mostrar só um link de texto, sem
iframe algum, contrariando o requisito. Restaurado o iframe sempre visível (com ou sem
chave configurada) mais o link "Abrir no Google Maps" sempre presente como saída
garantida caso o Google mostre "conteúdo bloqueado" dentro do iframe — validado
manualmente em `/eventos/evento-teste-mapa` (mapa real da Av. Paulista renderizado).

**Fora do escopo desta publicação:** múltiplos operadores, formulário custom inscrição, importação CSV, certificados, PWA equipe, Apple/Google Wallet, NFSe automática, sandbox Asaas em produção.

---

## 5. Segurança

### 5.1 Autenticação e sessão

| Item | Onde |
|------|------|
| Proxy admin: sessão de usuário (`is_platform_admin`+2FA) OU chave estática (emergência) | `api/admin/proxy`, `app/deps/platform_admin.py` |
| Sessão + CSP nonce (Next.js "proxy", antigo `middleware.ts`) | `frontend/src/proxy.ts`, `frontend/src/lib/csp.ts` |
| Verificação e-mail compra rápida | `email_verificacao.py` |
| Rotação token portaria | `evento_portaria.py` |
| Mensagens API em português | `api-errors.ts` |
| White-label pagamentos (sem marca do provedor) | `api-errors.ts`, `mensagens_publicas.py`, `documentacao/api/page.tsx` |
| Senhas com bcrypt | `services/auth.py` |
| JWT com `token_version` (invalida sessões antigas ao trocar senha/desativar conta) | `services/auth.py` |
| "Lembrar dispositivo" (30 dias sem novo desafio 2FA) | `services/auth.py` (`create/decode_trusted_device_token`), amarrado a `token_version` |

### 5.1.1 Admin integrado à conta do usuário (adicionado v1.11)

Ver spec dedicada: `specs/admin-integrado-usuario.md`. Resumo:

- `Usuario.is_platform_admin` (bool, independente de `tipo` cliente/organizador) — uma conta pode ser organizador+admin ou cliente+admin.
- Acesso ao painel via **login normal** (e-mail/senha) exige `is_platform_admin=True` **e** `totp_ativado=True`; sem 2FA, acesso bloqueado com mensagem explicando o motivo (não é mais preciso colar a chave todo login).
- `PLATFORM_ADMIN_API_KEY` mantida como **acesso de emergência** (sem exigir 2FA).
- TOTP liberado para `tipo=organizador` **OU** `is_platform_admin=True` (antes só organizador podia ativar).
- Gerenciamento: `PATCH /api/admin/usuarios/{id}/admin` — conceder/revogar o papel; primeiro admin definido via `scripts/set_platform_admin.py <email>` (rodado manualmente uma vez).
- Login de conta admin redireciona automaticamente para `/admin/dashboard` (`destinoPosAuth`). Item "Administração" aparece no dropdown do usuário (navbar) e no menu lateral (organizador/conta shells) quando `is_platform_admin=true`.

### 5.1.2 Roteamento Caddy + Next.js — lição aprendida (adicionado v1.11)

**Causa raiz de uma investigação bem longa** ("Not Found" persistente no painel admin, mesmo com sessão/chave válidas): duas armadilhas independentes, ambas no `deploy/caddy/Caddyfile`:

1. **Regra genérica `/api/:path*` no `next.config.ts` engolindo rotas do próprio Next.js.** `app/api/admin/session` e `app/api/admin/proxy/[...path]` são rotas do Next.js (não existem no FastAPI) — mas o rewrite `{ source: "/api/:path*", destination: \`\${apiTarget}/api/:path*\` }` intercepta e manda **tudo** que começa com `/api/` direto pro backend, antes do Next.js sequer tentar casar com essas duas rotas. Corrigido com regex negativo excluindo os dois prefixos: `source: "/api/:path((?!admin/session|admin/proxy).*)"`.
2. **`**` (glob de múltiplos níveis) não é reconhecido pelo matcher `path` do Caddy 2** — `/api/admin/proxy/**` casava só o primeiro nível (`/proxy/setup`), não caminhos mais profundos (`/proxy/marketing/contatos`), fazendo esses caírem na regra genérica `@api` e ir direto pro FastAPI (que não tem essa rota — 404). O correto no Caddy 2 é um **prefixo com asterisco colado, sem barra antes**: `/api/admin/proxy*` (não `/api/admin/proxy/*` nem `/api/admin/proxy/**`).

Ambas as correções têm comentários extensos no próprio `Caddyfile` e em `next.config.ts` explicando os erros comuns, para não repetir. `scripts/atualizar-vps-agora.sh`, `scripts/verificar-versao-site.sh` e `scripts/qa-funcional.py` ganharam checagens automáticas para detectar regressão nesse roteamento.

### 5.2 2FA — TOTP (adicionado v1.8)

- **Organizador:** TOTP opt-in (`Usuario.totp_ativado`), segredo cifrado em repouso (`totp_secret`), 8 códigos de recuperação de uso único (hash bcrypt). Login em duas etapas quando ativo: senha correta emite token de desafio de 5 min (`create_2fa_challenge_token`), segunda etapa em `POST /api/auth/2fa/verificar-login`. Gestão em `/organizador/perfil` → `SegurancaDoisFatores`.
  - Implementação TOTP própria (RFC 6238, HMAC-SHA1), validada contra `pyotp` como referência — sem dependência nova.
  - Endpoints: `POST /api/auth/2fa/{iniciar,ativar,desativar}`, `POST /api/auth/2fa/verificar-login`.
  - Arquivos: `app/services/totp.py`, `app/services/organizador_2fa.py`.
- **Admin (dois mecanismos, coexistindo — v1.11):**
  1. **Principal:** login normal (e-mail/senha) de uma conta com `is_platform_admin=True` e `totp_ativado=True` — mesmo TOTP de organizador, ver 5.1.1.
  2. **Emergência:** chave compartilhada (`PLATFORM_ADMIN_API_KEY`) + TOTP opcional em separado (`ADMIN_TOTP_SECRET`, opt-in) verificado em `frontend/src/app/api/admin/session/route.ts` antes de aceitar a chave, com rate limit de 8 tentativas/min por IP.
  - Implementação TOTP em TypeScript (Node `crypto`) em `frontend/src/lib/admin-totp.ts`, validada contra a implementação Python.

### 5.3 CAPTCHA — Cloudflare Turnstile (adicionado v1.8)

Opt-in via `TURNSTILE_SECRET_KEY` (API) + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend); desligado por padrão, não bloqueia `ready_for_production`. **Recomendado em produção** — `GET /api/admin/setup` → `checks.turnstile` = `recomendado` se a chave API estiver vazia; `validar-go-live-vps.sh` avisa. **Configuração VPS:** `scripts/configure-turnstile-env.sh` ou `scripts/setup-turnstile-e2e.sh` (cria widget via API se `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; valida secret com `scripts/turnstile-spin/validate.sh`). Widget React: `turnstile-widget.tsx` com `action=turnstile-spin-v2`, reset após erro de submit (token single-use). Build Docker produção passa `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`docker-compose.prod.yml`, `frontend/Dockerfile`). Verificação server-side canônica em `app/services/turnstile.py` → `https://challenges.cloudflare.com/turnstile/v0/siteverify`, aplicada em `/api/auth/{login,registrar,solicitar-recuperacao-senha,reenviar-verificacao-cadastro}` e `/api/public/contato`.

### 5.4 Rate limiting (`app/deps/rate_limit.py`)

| Bucket | Limite | Observação |
|---|---|---|
| `auth_login` | 8/min por IP | Reduzido de 30/min (07/2026) — dificulta força bruta |
| `auth_register` | 10/min por IP | |
| `financeiro_saque` | 5/min por IP | Adicionado v1.8 |
| `checkout_criar`, `checkin_validar`, `portaria_*`, `lista_publica` | ver código | Inalterados |
| Portaria/admin (Next.js) | 8/min por IP | TOTP do admin — implementado em memória no `route.ts` |

### 5.5 Dados sensíveis em repouso (adicionado v1.8)

- **CPF/CNPJ de repasse do organizador** (`Usuario.asaas_repasse_cpf_cnpj`) cifrado em repouso (LGPD) — coluna `Text` (era `String(14)`), migração `20260724_000042`.
- **Esquema `enc:v2`** em `app/utils/secret_storage.py`: salt aleatório por-registro (32 bytes) + PBKDF2-SHA256 600k iterações. Legado `enc:v1` (salt estático) continua sendo decifrado, re-cifrado para v2 na próxima escrita. `migrate_encryption()` disponível para rotação de `SECRET_KEY`.
- Validação de dígito verificador (CPF/CNPJ) antes de criar conta de recebimento — `app/utils/cpf.py` (`documento_valido`).

### 5.6 Webhooks e concorrência (adicionado v1.8)

- **Webhook Asaas:** token validado *antes* de ler o corpo (anti-DoS); limite de 512KB no payload; deduplicação atômica (`INSERT` + `flush()`) *antes* do processamento do evento — elimina janela de corrida entre dois webhooks concorrentes do mesmo `event_id`.
- **TOCTOU corrigido no saque:** `financeiro_organizador.py::solicitar_saque` recalcula o saldo liberado *dentro* do lock pessimista (`with_for_update`), não antes.
- **Lock no pagamento:** `marcar_ingressos_pi_pagos` usa `FOR UPDATE` — evita que webhook e polling PIX confirmem o mesmo pagamento simultaneamente.
- **Idempotency key da cobrança** inclui o billing type (`cob_{id}_{bucket}_{pix|credit_card}`) — troca de método de pagamento na mesma janela de 10min não reaproveita cache do Asaas.
- **SQLite bloqueado em produção** (`config/settings.py`) — os locks acima exigem Postgres.

### 5.7 Admin e superfícies de ataque (adicionado v1.8)

- Audit log (`admin_action=...`) em: atualizar assinatura, publicar/pausar evento, ativar/desativar usuário, disparar campanha.
- `SmtpTestBody.destino` usa `EmailStr` (era validação manual de `"@" in destino`).
- Exportação CSV de contatos protegida contra CSV/formula injection (prefixo `'` em campos iniciados por `=+-@`).
- CORS: `allow_methods`/`allow_headers` restritos à lista real usada pela API (era `"*"`).
- Reembolso com `valor=0.0` bloqueado (`pagamento_asaas.py`).
- HMAC do QR de check-in fortalecido de 12 para 20 caracteres (48→80 bits) em **novos** códigos; assinatura legada de 12 chars ainda aceita para não invalidar ingressos já emitidos antes da mudança (`ingresso_checkin.py`).

### 5.8 XSS — auditoria de lançamento (v1.41)

**Item 1 — upload SVG/ICO (crítico):** `image/svg+xml`, `image/x-icon` e `image/vnd.microsoft.icon` removidos de `ALLOWED_IMAGE_TYPES` (`asset_storage.py`). Tipos aceitos: JPEG, PNG, WebP, GIF (rasterizados para WebP no servidor). **Frontend (v1.44):** `upload-imagem-tipos.ts` centraliza `accept` e validação em `ImagemAssetField`, `evento-imagem-field`, admin favicon; `comprimir-imagem.ts` rejeita SVG/ICO antes do upload.

**Item 1b — URLs externas em banner/galeria (v1.45):** `validar_imagem_url` só aceita `https` no domínio da plataforma (`FRONTEND_PUBLIC_URL`), R2 (`R2_PUBLIC_URL`) ou `/uploads/`; UI de evento remove colagem de URL externa — só upload de arquivo.

**Item 2 — JSON-LD na página do evento (alto):** `serializeJsonLdForScript` (`frontend/src/lib/json-ld-html.ts`) escapa `<`, `>` e `/` após `JSON.stringify()` antes de `dangerouslySetInnerHTML` em `eventos/[slug]/page.tsx` (Event + BreadcrumbList).

Testes: `tests/test_xss_auditoria_lancamento.py` (upload SVG rejeitado; escape JSON-LD; UI sem SVG/ICO).

---

## 6. Variáveis de ambiente (produção)

| Variável | Obrigatório | Valor em produção |
|----------|-------------|-------------------|
| `ASAAS_API_KEY` | Sim | Chave `$aact_prod_...` — **não alterar** |
| `ASAAS_PLATFORM_WALLET_ID` | Sim | Wallet da plataforma — **não alterar** |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Token do webhook — **não alterar** |
| `ASAAS_ENVIRONMENT` | Sim | **`production`** (fixo) |
| `ASAAS_ONBOARDING_MODE` | Sim | **`linked`** (lançamento atual — organizador vincula conta própria); `baas` é o alvo quando houver CNPJ da conta mãe |
| `ASAAS_ALLOW_MANUAL_WALLET` | Sim | **`false`** (fixo) |
| `ASAAS_DISABLED` | Sim | **`false`** |
| `SECRET_KEY` | Sim (≥ 32 chars) | |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Sim | |
| `PLATFORM_ADMIN_API_KEY` | Sim | |
| `CORS_ORIGINS` | HTTPS, sem `*` | |
| `FRONTEND_PUBLIC_URL` | URL pública | |
| `POSTGRES_PASSWORD` | Sim | |
| `TURNSTILE_SECRET` | Recomendado | Secret do widget (canônico Spin); alias legado `TURNSTILE_SECRET_KEY` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Recomendado | Site key `0x4AAAAAAEEo9-dlOUxCWAz5` — build Docker frontend |

Checks: `production_checks.py` → `GET /api/admin/setup`. Em produção valida:

- `ASAAS_ENVIRONMENT=production`
- `ASAAS_ONBOARDING_MODE=linked` (lançamento atual; `onboarding_ok` já aceita `linked`/`baas`/`both`)
- `ASAAS_ALLOW_MANUAL_WALLET=false`
- `ASAAS_DISABLED=false` (check `asaas_payments_enabled`)
- Conta mãe Asaas **CNPJ** — só verificado/exigido se o modo for `baas`/`both` (check `asaas_platform_cnpj`); não aplicável em `linked`
- Senha Postgres, `CORS_ORIGINS` só HTTPS, `FRONTEND_PUBLIC_URL` preenchida

Bloqueia `ready_for_production` se qualquer check crítico estiver `pendente`.

---

## 7. Critérios de conclusão para publicação

### Pagamentos (código)

- [x] Split só para organizador; taxa na conta emissora
- [x] Conta de recebimento criada pela plataforma (`ASAAS_ONBOARDING_MODE=baas`) — **fechado por decisão** (fora de escopo até CNPJ); produção segue `linked` (organizador cria/vincula no Asaas) — decisão 02/08/2026
- [x] Organizador PF ou PJ — rotas `conta-recebimento`; sem “subconta” na UX
- [x] Pré-check conta mãe CNPJ + mensagem clara se plataforma PF (`asaas_plataforma.py`)
- [x] Tracker dinâmico de conta e assinatura com polling + e-mails (`onboarding_tracker.py`, `status-tracker.tsx`)
- [x] KYC → status `approved` libera venda e publicação
- [x] Bloqueio venda/publicação sem conta de recebimento aprovada
- [x] Extrato, vendas agrupadas, estornos, saque Pix white-label
- [x] Asaas somente produção no VPS (credenciais fixas; `asaas_env()` força production)

### UX conta e login (código)

- [x] ContaShell lateral persistente (`/conta/*`)
- [x] Subrotas organizador `/organizador/perfil/*` (mesmos clients)
- [x] Dropdown organizador com **Perfil** e **Painel**; Pagamentos/Ingressos/Notificações via `PerfilTabs`
- [x] Abas horizontais via `PerfilTabs` em `/organizador/perfil/*` (validado em produção)
- [x] Rodapé estável (shell + `EarlyScrollReset` — validado no VPS)
- [x] Máscaras formulários
- [x] White-label: mensagens sanitizadas; UI usa conta de recebimento (sem subconta/Asaas expostos)

### Qualidade (código + CI)

- [x] `pytest` verde (**504** passed + 1 skipped; collect **505**)
- [x] `npm run build` verde
- [x] CI `api`, `web`, `e2e`, `e2e-compra`, `e2e-asaas`, `prod-compose` configurados em `.github/workflows/ci.yml`; job `api` roda com serviço Redis desde v1.16 (antes falhava com 15 erros nos testes de fila confiável por falta de Redis no runner)
- [x] Teste mock compra + split: `scripts/test-compra-split-mock.sh`
- [x] OpenAPI exportado sem paths `subconta` (`export-openapi.py` white-label)
- [x] API status usa só `tem_conta_recebimento` / `permite_conta_recebimento` (sem aliases legados)
- [x] Checkout: código `repasse` + aviso proativo antes do pagamento (`compra_indisponivel_codigo`)

### Operação (VPS)

**Estado do repositório:**

- [ ] Deploy VPS v1.50.9 — após merge (`atualizar-vps-agora.sh`)
- [x] tip de produto (VPS) — **`e370a63`** / v1.50.8 até deploy v1.50.9
- [x] tip `main` (spec) — **`266cb34`** / v1.50.8.3 (PR #124)
- [x] Playbook Oficial de Marketing — `docs/14-playbook-marketing-eventosbr.md` (§2.19 / v1.50.7)
- [x] Docs técnicas fora do site — §2.20 / v1.50.8 (código + **produção**: 404 `/documentacao*`, `/openapi.json`)
- [x] Deploy VPS v1.50.8 — confirmado 05/08/2026 (`atualizar-vps-agora.sh`; API/Web `e370a63`; `/ready` OK; Deploy Key SSH após repo privado)
- [x] Deploy VPS v1.50.x (hero/navbar) — confirmado 04/08/2026 (`atualizar-vps-agora.sh`; `/ready` OK)
- [x] v1.47 lançamento UX/Ads — home dual, Pixel/GTM admin, migração `20260802_000049` (código)
- [x] Deploy VPS v1.47.2 — **`915d2aa`** — confirmado 03/08/2026 (`atualizar-vps-agora.sh`; API/Web `915d2aa`; health/ready OK)
- [x] Migração `20260802_000049` (Pixel/GTM em `platform_settings`) — aplicada (`alembic upgrade head`)
- [x] Disco VPS — limpeza build cache Docker 03/08/2026 (`docker builder prune -af`; 68 GB → 5,8 GB usados; stack healthy). **Nunca** `docker system prune --volumes` em produção.
- [ ] Meta Pixel / GTM — colar IDs em Admin → Configurações (ou `.env`); só necessário ao rodar campanhas Ads
- [x] tip de produto — v1.46 mergeado; VPS **`d608169`** (deploy v1.46 confirmado 02/08/2026)
- [x] E2E seeds — `registrarOrganizadorE2e` + contato obrigatório nos seeds; cookie sessão expirada usa `baseURL` do Playwright (fecha PR #101)
- [x] **Turnstile em produção** — chaves no `.env` + rebuild `web`/`api` (confirmado 02/08/2026; Managed mode — validação automática para visitantes legítimos)
- [x] Conta mãe Asaas em **CNPJ** — **fechado por decisão** (adiado até PJ no Asaas); não bloqueia `linked` (02/08/2026)
- [x] Deploy VPS — **`d2c9e4b`** / v1.43 — confirmado 02/08/2026 (`verificar-versao-site.sh`)
- [x] Deploy VPS `de12227` / v1.42.2 — confirmado 02/08/2026
- [x] Deploy VPS v1.44 — **`df08e23`** confirmado 02/08/2026 (`verificar-versao-site.sh`; API/Web commit `df08e23`)
- [x] Migration `20260724_000042_encrypt_cpf_cnpj_repasse` aplicada em produção (confirmado no log de deploy)
- [x] Onboarding `ASAAS_ONBOARDING_MODE=linked` — modelo **definitivo até CNPJ**; organizador cria conta no Asaas e preenche dados lá (02/08/2026)
- [x] `GET /api/admin/setup` → `asaas_platform_cnpj` — **N/A em `linked`**; relevante só ao migrar para `baas` (fechado)

**Validado no VPS em produção (deploy `e6df57d`, 25/07/2026 — baseline; modo atual = `linked`):**

- [x] `.env` produção preenchido
- [x] `ASAAS_ENVIRONMENT=production` e `ASAAS_ONBOARDING_MODE=linked` *(histórico do checklist citava `baas` por engano — corrigido no /review v1.30; ver §11 L2)*
- [x] `verify-production.sh` / `verificar-versao-site.sh`
- [x] Webhook token HTTP 200 (`test-asaas-webhook.sh --expect-ok`) — revalidar após trocar conta Asaas

**Checklist §2.8 (webhook/SMTP — fechado via 1ª venda §2.8 C):**

```bash
cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh
```

- [x] Webhook configurado e testado com evento real (`PAYMENT_RECEIVED`) — §2.8 A *(validado indiretamente pela 1ª venda §2.8 C; pré-check `test-asaas-webhook.sh` no baseline VPS)*
- [x] SMTP + envio real de ingresso — §2.8 B *(validado indiretamente pela 1ª venda §2.8 C; SPF/DKIM = melhoria contínua DNS, não bloqueia lançamento)*
- [x] Primeira venda real validada (PIX ou cartão + e-mail recebido) — §2.8 C *(02/08/2026, usuário)*

---

## 8. Referência de arquivos

| Área | Arquivos |
|------|----------|
| Split / cobrança | `pagamento_asaas.py`, `pagamentos_asaas_handlers.py` |
| Conta de recebimento | `organizador_asaas.py`, `asaas_plataforma.py`, `evento_repasse.py` |
| Onboarding tracker | `onboarding_tracker.py`, `onboarding_email.py`, `status-tracker.tsx`, `use-status-polling.ts` |
| Financeiro | `financeiro_organizador.py`, `financeiro_conciliacao.py`, `saque_asaas.py` |
| UI financeiro | `organizador-repasses-painel.tsx` |
| Conta / perfil | `conta-shell.tsx`, `perfil-tabs.tsx`, `conta/layout.tsx`, `organizador/perfil/layout.tsx` |
| Sessão expirada → login | `proxy.ts`, `lib/api.ts`, `lib/session-expired-cookie.ts`, `auth-client.tsx` |
| White-label | `api-errors.ts`, `mensagens_publicas.py`, `documentacao/api/page.tsx`, `export-openapi.py` |
| 2FA (organizador + admin) | `services/totp.py`, `services/organizador_2fa.py`, `components/seguranca-2fa.tsx`, `lib/admin-totp.ts`, `app/api/admin/session/route.ts` |
| Admin integrado à conta | `deps/platform_admin.py`, `routes/admin.py` (`/usuarios/{id}/admin`), `scripts/set_platform_admin.py`, `components/tornar-organizador-card.tsx`, `specs/admin-integrado-usuario.md` |
| Contato do evento / plataforma | `schemas/evento.py` (contato_telefone/email), `models/platform_settings.py`, `routes/public.py` (`/contato`), `app/contato/` |
| PDV presencial + correção | `services/pdv_presencial.py`, `services/pdv_correcao.py`, `services/conta_cliente.py`, `routes/eventos.py` (`/pdv`, `/pdv/vendas/*`), `pdv-presencial-client.tsx` |
| Compressão de imagem | `lib/comprimir-imagem.ts` (navegador), `utils/imagem_processamento.py` (servidor, Pillow) |
| CAPTCHA | `services/turnstile.py`, `components/turnstile-widget.tsx` |
| Cifra em repouso (CPF/CNPJ, API keys) | `utils/secret_storage.py` (esquema `enc:v2`), `utils/cpf.py` |
| SEO | `app/sitemap.ts`, `app/robots.ts`, `lib/site-metadata.ts`, `lib/organization-json-ld.ts`, `lib/analytics.ts`, `components/marketing-analytics.tsx`, `lib/eventos-listagem-metadata.ts`, `lib/json-ld-html.ts`, `app/eventos/page.tsx` (metadata cidade), `app/eventos/[slug]/page.tsx` (JSON-LD + typicalAgeRange) |
| Verificação deploy | `verificar-versao-site.sh`, `verify-production.sh` |
| Config / checks | `config/settings.py`, `production_checks.py`, `.env.production.example` |
| Go-live ops | `docs/11-go-live-asaas.md`, `atualizar-vps-agora.sh`, `configure-asaas-env.sh`, `configure-turnstile-env.sh`, `setup-turnstile-e2e.sh`, `turnstile-spin/` |
| Marketing (playbook) | `docs/14-playbook-marketing-eventosbr.md`, `docs/README.md` |
| Docs não públicas | `scripts/export-openapi.py` → `docs/openapi.generated.json`; `tests/test_docs_nao_publicas.py` |
| Auditoria v1.50.9 | `docs/15-auditoria-lancamento-2026-08.md`, `tests/test_auditoria_lancamento_v1509.py`, `frontend/src/app/not-found.tsx`, `frontend/src/app/error.tsx`, `frontend/src/lib/produtor-publico.ts` |
| Testes | `test_compra_split_fluxo_mock.py`, `test-compra-split-mock.sh`, `test-asaas-webhook.sh`, `test-asaas-connection.py`, `validar-go-live-vps.sh`, `test_xss_auditoria_lancamento.py`, `test_pdv_correcao_email.py` |
| CI | `.github/workflows/ci.yml` |
| Backup produção | `backup-prod-env.sh`, `verify-prod-backup.sh`, `restore-prod-env.sh` |

---

## 9. Extensões (não bloqueiam publicação)

Antecipação automática de cartão, cancelamento de saque, mock E2E (`ASAAS_E2E_MOCK`), scripts de setup de webhook, comprovante de transferência, backfill de ledger. Modo `linked` **não é legado-só-dev** enquanto o lançamento rodar sem CNPJ da conta mãe — ver `specs/onboarding-linked-lancamento.md` e §11 L2.

---

## 11. `/review` — build vs spec

### 11.0 Histórico rápido

| Review | Tip | Veredito |
|--------|-----|----------|
| v1.30 | `f3f2e8b` / 389 | NÃO aprovada — L1, L2, L3 |
| v1.31 | `9082c90` / 390 | NÃO aprovada — L4 restos linked, L5 docstring |
| build `a32b948` | fechou L4+L5 | — |
| v1.32 | `a32b948` / 390 | aprovada (pelo build que fechou L4/L5) |
| v1.33 | `a32b948` / 390 | APROVADA — L1–L5 |
| v1.42.2 | `4125ff4` / 438 | APROVADA — §2.12 v1.42 + §5.8 |
| v1.43.3 | `a665533` / 442 | APROVADA — v1.43 + deploy `d2c9e4b` |
| v1.44 | `6c2e031` / **445** | APROVADA — merge PR #91 `733d227` |
| v1.44.2 | `68bd595` / **445** | APROVADA — fechamento pendências spec/ops |
| v1.44.3 | `df08e23` / **445** | APROVADA — deploy VPS v1.44 confirmado |
| v1.45 | `9c6044a` / **449** | APROVADA — e-mail organizador + imagens + Turnstile build |
| v1.46 | `d608169` / **452** | APROVADA — UX cadastro organizador + Turnstile ops |
| v1.46.1 | `d608169` / **452** | APROVADA — deploy VPS v1.46 confirmado |
| v1.47 | `915d2aa` / **470** | APROVADA — home dual + Ads/SEO |
| v1.47.1 | `915d2aa` / **470** | APROVADA — Pixel/GTM no admin |
| v1.47.2 | `915d2aa` / **470** | APROVADA — admin config UX + `.input` |
| **v1.47.3** | `915d2aa` / **470** | APROVADA — fechamento spec/PR #99 |
| v1.47.3.1 | `915d2aa` / **470** | APROVADA — deploy VPS v1.47 confirmado |
| **v1.47.4** | `5dcbad8` / **474** | APROVADA — sessão expirada → `/auth` |
| **v1.48 (este)** | `84c4cba` / **475** | **APROVADA** — UX admin, whitelabel, contato |
| **v1.48.1** | branch `cursor/fix-navbar-final-c0b1` / **475** | **APROVADA** — regressão navbar (dropdowns portal, Sobre visível, menu conta) |
| **v1.49** | `9142f97` / **479** | **APROVADA** — tema de marca proporcional (§2.17) |
| **v1.49.1** | `f14d887` / **480** | **APROVADA** — navbar + whitelabel escopo + ops disco |
| **v1.50** | merge home lançamento / **485** | **APROVADA** — home lançamento (§2.18) |
| **v1.50.1** | merge PR #111 / **486** | **APROVADA** — hero claro + foto marketing |
| **v1.50.2** | merge PR #112 / **487** | **APROVADA** — hero full-bleed viewport |
| **v1.50.3** | tip `1dfd6aa` + fechamento / **487** | **APROVADA** — deploy VPS + alinhamentos + fecha PR #101 |
| **v1.50.4** | merge PR #116 / **491** | **APROVADA** — navbar sem Login isolado |
| **v1.50.5** | merge PR #117 / **492** | supersedida — densidade indesejada no CTA/nome |
| **v1.50.6** | merge PR #118 / **492** | **APROVADA** — Sobre ok; CTA/nome restaurados |
| **v1.50.6.1** | tip `46b470a` + `/review` / **492** | **APROVADA** — fechamento spec/build/review |
| **v1.50.7** | tip `3306f62` / **492** | docs — Playbook Oficial de Marketing (§2.19) |
| **v1.50.8** | tip `dfabe91` (PR #121) / **496** | **APROVADA** (código) — docs fora do site (§2.20) |
| **v1.50.8.1** | tip `e370a63` (PR #122) / **496** | **APROVADA** — fechamento spec; deploy pendente na época |
| **v1.50.8.2** | VPS `e370a63` + PR #123 / **496** | **APROVADA** — deploy VPS confirmado; docs 404 no ar |
| **v1.50.8.3** | tip `266cb34` + rechecagem produção / **496** | **APROVADA** — fechamento /review pós-deploy |
| **v1.50.9 (este)** | branch `cursor/auditoria-correcoes-c0b1` / **505** | **APROVADA** — auditoria pertinente (§2.21) |

### 11.1 Requisitos recentes — resultado (v1.50.9)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.21 | API erro genérico em produção | **PASS** |
| §2.21 | Upload fail-closed (imagem inválida) | **PASS** |
| §2.21 | `not-found.tsx` + `error.tsx` | **PASS** |
| §2.21 | Sitemap pagina além de 100 | **PASS** |
| §2.21 | Produtor SSR + generateMetadata + twitter | **PASS** |
| §2.21 | Evento metadata twitter | **PASS** |
| §2.21 | robots rotas privadas extras | **PASS** |
| §2.21 | migrate_encryption CPF/TOTP | **PASS** |
| §2.21 | Next.js 16.3.0 + `npm run build` | **PASS** |
| §2.21 | gitignore graphify-out | **PASS** |
| §7 Qualidade | `pytest` collect **505** | **PASS** |
| `/review` | Checklist código × spec | **APROVADA** |

### 11.1 Requisitos recentes — resultado (v1.50.8.3)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.20 | Produção: `/documentacao`, `/documentacao/api`, `/openapi.json` → 404 | **PASS** |
| §7 Ops | VPS API/Web `e370a63`; `/ready` OK | **PASS** |
| §7 Ops | `main` tip `9db907d` (spec v1.50.8.2 mergeada) | **PASS** |
| §7 Ops | Repo privado + Deploy Key SSH operacional | **PASS** |
| `/review` | Checklist código × spec × produção | **APROVADA** |

### 11.1 Requisitos recentes — resultado (v1.50.8.2)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.20 | Produção: `/documentacao` e `/documentacao/api` → 404 | **PASS** |
| §2.20 | Produção: `/openapi.json` → 404 | **PASS** |
| §7 Ops | API/Web commit `e370a63`; `/ready` OK | **PASS** |
| §7 Ops | Deploy Key SSH (repo privado) + `atualizar-vps-agora.sh` | **PASS** |
| `/review` | Checklist código × spec × produção | **APROVADA** |

### 11.1 Requisitos recentes — resultado (v1.50.8.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.20 | Código `main` `dfabe91`: páginas docs removidas | **PASS** |
| §2.20 | Sem `frontend/public/openapi.json` no tip | **PASS** |
| §2.20 | Export → `docs/openapi.generated.json`; footer/sitemap/robots | **PASS** |
| §2.20 | `tests/test_docs_nao_publicas.py` (collect **496**) | **PASS** |
| §7 Ops | Deploy VPS aplica 404 no ar (`/documentacao`, `/openapi.json`) | supersedido — **PASS** na v1.50.8.2 |
| `/review` | Checklist código × spec | **APROVADA** |

### 11.1 Requisitos recentes — resultado (v1.50.8)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.20 | `/documentacao` e `/documentacao/api` removidas | **PASS** |
| §2.20 | Sem `frontend/public/openapi.json` | **PASS** |
| §2.20 | Export OpenAPI em `docs/openapi.generated.json` | **PASS** |
| §2.20 | Footer/sitemap sem docs; robots Disallow | **PASS** |
| §2.20 | `tests/test_docs_nao_publicas.py` | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.7)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.19 | Playbook em `docs/14-playbook-marketing-eventosbr.md` | **PASS** |
| §2.19 | Índice em `docs/README.md` aponta o playbook | **PASS** |
| §2.19 | Proposta de valor + promessa + pilares + Ciclo 1 documentados | **PASS** |
| §8 | Referência de arquivos inclui playbook | **PASS** |
| §7 Qualidade | Sem mudança de código de produto (docs only) | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.6.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.18 | Hero claro + full-bleed + foto `/marketing/hero-evento` | **PASS** |
| §2.18 | Home mobile-center; `/produtores` título mobile + parágrafo justificado | **PASS** |
| §2.16 / §2.17 | Navbar: links `shrink-0`; Sobre visível; auth agrupado | **PASS** |
| §2.16 / §2.17 | CTA «Crie um evento» + nome no chip (sem compactar) | **PASS** |
| §2.16 / §2.17 | `AUTH_SYNC_EVENT` + portal conta/Categorias | **PASS** |
| §7 Ops | Produção: hero + navbar attrs; `/ready` OK | **PASS** |
| §7 Qualidade | `pytest` home + navbar layout; collect **492** | **PASS** |
| §7 Qualidade | `/build`: implementação já na `main` (sem lacuna de código) | **PASS** |
| `/review` | Checklist código × spec | **APROVADA** |

### 11.1 Requisitos recentes — resultado (v1.50.6)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.16 / §2.17 | Sobre visível (`shrink-0` nos links; sem overflow escondendo) | **PASS** |
| §2.16 / §2.17 | Chip da conta com **nome** (`sm:inline`) | **PASS** |
| §2.16 / §2.17 | CTA «Crie um evento» tamanho v1.50.4 (não encolher ao logar) | **PASS** |
| §7 Qualidade | `test_navbar_layout` | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.4)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.16 / §2.17 | `lg+`: links sem `flex-1`; auth após links com separador | **PASS** |
| §2.16 / §2.17 | Login e CTA no mesmo grupo `data-navbar-auth` | **PASS** |
| §2.16 / §2.17 | Slot auth troca Login → conta ao logar (`AUTH_SYNC_EVENT`) | **PASS** |
| §2.16 / §2.17 | Links Funcionalidades…Sobre + Categorias portal | **PASS** |
| §7 Qualidade | `pytest` 491 (collect) / layout tests PASS | **PASS** |
| §7 Qualidade | `next build` | **PASS** |
| §7 Qualidade | Visual desktop: auth agrupado após Sobre | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.3)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.18 | Deploy VPS tip ≥ `1dfd6aa` (hero claro/full-bleed em produção) | **PASS** |
| §2.18 | Home hero centralizado no mobile; `/produtores` título mobile-center + parágrafo justificado | **PASS** |
| §7 Ops | `/ready` OK; `/marketing/hero-evento.webp` 200 | **PASS** |
| §7 Qualidade | E2E seeds organizador + cookie `baseURL` (absorve PR #101) | **PASS** |
| §7 Qualidade | `pytest` 487 | **PASS** |
| GitHub | PR #101 fechada (conteúdo útil incorporado; branch obsoleta vs `main`) | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.2)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.18 | Hero full-bleed viewport (`data-home-hero-fullbleed` + `:has`) | **PASS** |
| §2.18 | Sem `w-screen` (sem overflow mobile) | **PASS** |
| §2.18 | Resto da home no container | **PASS** |
| §7 Qualidade | `pytest` 487 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.18 | Hero claro (sem `bg-zinc-950`) + foto `/marketing/hero-evento` | **PASS** |
| §2.18 | Copy organizador + CTAs mantidos | **PASS** |
| §2.18 | Bloco comprador secundário (PIX→QR) | **PASS** |
| §7 Qualidade | `pytest` 486 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.50)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.18 | Hero marca + promessa organizador + CTAs | **PASS** |
| §2.18 | Bloco comprador secundário (PIX→QR) | **PASS** |
| §2.18 | Features sem jargão Whitelabel/Split | **PASS** |
| §2.18 | Prova social só com volume mínimo | **PASS** |
| §2.18 | Cenários (não depoimentos fictícios) | **PASS** |
| §2.18 | FAQ marca em `/produtor` | **PASS** |
| §2.18 | Copy preços «Pague só quando vender» | **PASS** |
| §7 Qualidade | `pytest` 485 | **PASS** |
| §7 Qualidade | Playwright home h1 + navegação | **PASS** |
| §7 Qualidade | `next build` | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.49.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.17 | Plataforma: escala `--brand-50`…`950` + `@theme` emerald | **PASS** |
| §2.17 | Plataforma: apply ao salvar / SSR no `<html>` | **PASS** |
| §2.17 | Whitelabel organizador: só `/produtor/[slug]` (escopo local) | **PASS** |
| §2.17 | Página evento **não** aplica tema do organizador em `:root` | **PASS** |
| §2.17 | Navbar: links contínuos; Sobre/Categorias/Eventos visíveis | **PASS** |
| §2.17 | Busca navbar: digita sem perder foco | **PASS** |
| §7 Ops | Disco VPS: build cache limpo; volumes críticos intactos | **PASS** |
| §7 Qualidade | `pytest` 480 | **PASS** |
| §7 Qualidade | Playwright navbar + busca | **PASS** |
| §7 Qualidade | `next build` frontend | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.49)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.17 | Escala `--brand-50`…`950` derivada de primária + escura | **PASS** |
| §2.17 | `emerald-*` remapeado via `@theme` | **PASS** |
| §2.17 | Tema admin reativo ao salvar (sem reload) | **PASS** |
| §2.17 | Escala no `<html style>` (SSR) + `emerald-*` → `--brand-*` | **PASS** |
| §2.17 | Logo padrão 180×44 com `--brand-600` (sem alargar navbar) | **PASS** |
| §2.17 | Navbar: Eventos adjacente a Categorias (sem overlap) | **PASS** |
| §7 Qualidade | `pytest` 479 | **PASS** |
| §7 Qualidade | `next build` frontend | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.48.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.16 | Navbar xl 1 linha; md–lg 2 linhas sem overlap | **PASS** |
| §2.16 | Dropdown Categorias lista itens e navega | **PASS** |
| §2.16 | Logado: Sobre visível em md–lg | **PASS** |
| §2.16 | Menu conta: Painel/Admin/Perfil/Sair clicáveis | **PASS** |
| §2.16 | Portal único menu conta (sem duplicar DOM) | **PASS** |
| §7 Qualidade | `pytest` 475 | **PASS** |
| §7 Qualidade | Playwright navbar (patamar) | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.48)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.16 | E-mail duplicado → mensagem + login/recuperar | **PASS** |
| §2.16 | Admin config: tamanhos imagem + paleta cores | **PASS** |
| §2.16 | Whitelabel: paleta cores organizador | **PASS** |
| §2.16 | Máscara telefone (`TelefoneInput`) | **PASS** |
| §2.16 | Admin editar usuário | **PASS** |
| §2.16 | PDV mensagem compra realizada | **PASS** |
| §2.16 | Contato: título centralizado + texto justificado | **PASS** |
| §2.16 | Marketing webp funcionalidades/produtores | **PASS** |
| §2.16 | Navbar layout (xl 1 linha; md–lg 2 linhas) | **PASS** |
| §7 Qualidade | `pytest` 475 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.47.4)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §3.2.1 | Sessão expirada redireciona a `/auth` (não `/cadastro`) | **PASS** |
| §3.2.1 | Cookie `eventosbr_session_expired` no middleware | **PASS** |
| §3.2.1 | 401 API limpa cache e força login | **PASS** |
| §3.2.1 | Visitante novo `/organizador/novo` → `/cadastro` (sem marcador) | **PASS** |
| §7 Qualidade | `pytest` 474 | **PASS** |
| §7 Ops | Deploy VPS v1.47.4 | **PENDENTE** (ops) |

### 11.1 Requisitos recentes — resultado (v1.47.3.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §7 Ops | Deploy VPS `915d2aa` (`atualizar-vps-agora.sh`) | **PASS** |
| §7 Ops | `verificar-versao-site.sh` + verify-production | **PASS** |
| §7 Ops | Migração `20260802_000049` | **PASS** |
| §7 Ops | Pixel/GTM no admin (campanhas) | **PENDENTE** (ops — ao iniciar Ads) |
| §2.13–§2.15 | Baseline em produção | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.47.3)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §11 / PR | PR #99 mergeado na `main` | **PASS** |
| §7 | Spec §2.7/§7 contagens pytest 470 | **PASS** |
| §7 Ops | Deploy VPS `915d2aa` | **PASS** (v1.47.3.1) |
| §7 Ops | Pixel/GTM no admin (campanhas) | **PENDENTE** (ops — colar ID no painel) |
| §2.13–§2.15 | Baseline v1.47.2 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 470 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.47.2)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.15 | Classe `.input` com bordas visíveis | **PASS** |
| §2.15 | Painel admin objetivo (Marca visual compact) | **PASS** |
| §2.14 / §2.13 | Sem regressão Pixel/home/analytics | **PASS** |
| §7 Qualidade | `pytest` 470 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.47.1)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.14 | Admin salva Meta Pixel ID + GTM ID | **PASS** |
| §2.14 | `/api/public/platform` expõe IDs + fallback env | **PASS** |
| §2.14 | Frontend injeta scripts com IDs do painel | **PASS** |
| §2.14 | Migração `20260802_000049` | **PASS** |
| §2.13 / baseline | Sem regressão v1.47 | **PASS** |
| §7 Qualidade | `pytest` 470 | **PASS** |
| §7 Ops | `alembic upgrade head` na VPS após deploy | **PASS** (v1.47.3.1) |

### 11.1 Requisitos recentes — resultado (v1.47)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.13 | Home dual comprador × organizador + FAQ + features produtor | **PASS** |
| §2.13 | Cards vitrine cidade + CTA comprar | **PASS** |
| §2.13 | Wizard «Etapa n de 3» | **PASS** |
| §2.13 | Copy sem jargon em funcionalidades/sobre | **PASS** |
| §2.13 | Organization JSON-LD + og-image + marketing webp | **PASS** |
| §2.13 | noindex organizador/conta layouts | **PASS** |
| §2.13 | Pixel/GTM + eventos ViewContent/Lead/Register/Checkout/Purchase | **PASS** (admin ou `.env`) |
| §2.9–§2.12 / §3.3 | Baseline v1.46 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 470 | **PASS** |
| §7 Ops | Pixel/GTM (campanhas Ads) | **PENDENTE** (ops — admin ou `.env`) |

### 11.1 Requisitos recentes — resultado (v1.46)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §3.3 | Tela pública «Conta criada» + e-mail em `/cadastro?confirmar=1` sem login | **PASS** |
| §3.3 | Não redireciona ao login/painel após cadastro organizador pendente | **PASS** |
| §5.3 | `configure-turnstile-env.sh` + `.env.production.example` + bootstrap preserva chaves | **PASS** |
| §5.3 | Frontend bloqueia submit sem token quando site key no build | **PASS** |
| §3.3 / §5.3 / §2.9–§2.12 | Baseline v1.45 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 449 (CI) | **PASS** |
| §7 Ops | Turnstile no VPS | **PASS** (v1.46.1 — confirmado 02/08/2026) |

### 11.1 Requisitos recentes — resultado (v1.45)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §3.3 | Cadastro organizador — e-mail 24h, UI confirmação, login bloqueado | **PASS** |
| §5.8 | `imagem_url` só domínio/R2/uploads; UI sem URL externa | **PASS** |
| §5.3 | Turnstile `NEXT_PUBLIC` no build Docker produção | **PASS** |
| §3.3 / §2.9–§2.12 | Baseline v1.44 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 449 | **PASS** |

### 11.1 Requisitos recentes — resultado (v1.44)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §5.8 | `ImagemAssetField` / `comprimir-imagem` sem SVG/ICO (UX alinhada ao backend) | **PASS** |
| §5.8 | JSON-LD + upload backend (regressão v1.41) | **PASS** |
| §5.3 | Turnstile: check `recomendado` em setup + aviso no `validar-go-live-vps.sh` | **PASS** |
| §2.8 | Script go-live §2.8 A/B/C + Turnstile | **PASS** (automatizado + manual) |
| §2.12 / §2.9–§2.11 | Baseline v1.43 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 445 | **PASS** |
| §7 Ops | Deploy `df08e23` / v1.44 em produção | **PASS** |

### 11.1 histórico (v1.43.3)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.12 | Self-service vincular ingresso + PDV v1.42 | **PASS** |
| §5.8 | SVG/ICO backend + favicon admin `accept` | **PASS** |
| §2.2–§2.4 | `linked` até CNPJ | **PASS** |
| §2.8 C | Primeira venda real | **PASS** |
| §7 Ops | Deploy `d2c9e4b` confirmado | **PASS** |
| §7 Qualidade | `pytest` 442 | **PASS** |

### 11.1 histórico (v1.42.2)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.12 | Confirmação dupla de e-mail na venda PDV | **PASS** |
| §2.12 | `send_ticket_email_sync` + fallback; `email_enviado_sync` na API | **PASS** |
| §2.12 | Busca/correção/reenvio só dono; reatribui `usuario_id` | **PASS** |
| §2.12 | Busca por telefone (`ingresso_busca`) | **PASS** |
| §5.8 | SVG/ICO bloqueados; JSON-LD escapado | **PASS** |
| §2.9–§2.11 | Baseline v1.33 sem regressão | **PASS** |
| §7 Qualidade | `pytest` 438 | **PASS** |
| §7 Ops | Deploy `4125ff4` / v1.42 confirmado 02/08 | **PASS** |

### 11.1 histórico (v1.33)

| Spec | Requisito | Resultado |
|------|-----------|-----------|
| §2.9 | Carrinho / promoters / galeria | **PASS** |
| §2.10 | Ficha técnica + migração `000047` + UI sem placeholder | **PASS** |
| §2.10 | WhatsApp `/contato` via `social_whatsapp_url` | **PASS** |
| §2.10 | Duplicar → editar, `publicado=false` | **PASS** |
| §2.10 | DELETE dono-only; bloqueia `pago`/`pendente`/`usado` | **PASS** |
| §2.11 | Metadata `?cidade=`; `typicalAgeRange` | **PASS** |
| §2.11 | Teste SEO sem `cwd="/workspace"` | **PASS** |
| §2.2–§2.4 / §4 | Narrativa `linked` = lançamento | **PASS** |
| §2.10 docstring API | Menciona `usado` | **PASS** (L5) |
| §7 Qualidade | `pytest` 390 | **PASS** |
| §2.8 A–C | Webhook / SMTP / 1ª venda | **PASS** (C validado; A/B indireto — v1.44.2) |
| §7 Pagamentos | Conta `baas` | **fechado por decisão** (`linked` até CNPJ) |

### 11.2 Lacunas L1–L5 — status final

| ID | Item | Status |
|----|------|--------|
| L1 | DELETE bloqueia `usado` | ✅ `9082c90` |
| L2 | §2.2/§2.3/§6 alinhar `linked` | ✅ (completado via L4 em `a32b948`) |
| L3 | Tip deploy ≠ SHA docs | ✅ |
| L4 | Restos “linked só-dev / fora de escopo” | ✅ `a32b948` — revalidado: §2.2 nota linked; §2.3 linked=atual; §2.4 `status_repasse_aprovados`; §4 sem linked/both |
| L5 | Docstring DELETE omite `usado` | ✅ `a32b948` — revalidado: `pago, pendente ou usado (check-in)` |

### 11.3 Não são lacunas de código desta build

- CNPJ conta mãe e `baas` — **fechados por decisão** (02/08/2026); não são lacunas de código.
- §2.8 A/B — **fechados** por evidência da 1ª venda (§2.8 C); SPF/DKIM DNS = melhoria contínua.
- Rotação automática de chave — descartada (changelog 1.29).

### 11.5 Evidência L4/L5 (revalidação v1.33)

- **L4:** grep por “legado / fora do escopo / linked só-dev” nos trechos normativos §2.2–§2.4/§4 — limpo; §2.2 rotulada como modelo `baas` (alvo) com nota de lançamento `linked`.
- **L5:** `app/routes/eventos.py` filtro `("pendente", "pago", "usado")` + docstring alinhada; teste `test_deletar_evento_com_ingresso_usado_bloqueado` presente.

### 11.6 Critério de aprovação — ✅ atingido (v1.47.3.1)

**Em produção.** VPS **`915d2aa`** / v1.47.2 (home dual, Ads/SEO, Pixel admin, admin config UX). Deploy confirmado 03/08/2026. Única pendência ops: colar Pixel/GTM no admin ao iniciar campanhas Facebook/Instagram. `pytest` **470** (CI).

---

### 11.6 histórico (v1.47.3)

**Aprovado para lançamento comercial.** Código na `main`; PR #99 mergeado. Deploy e Pixel/GTM antes de Ads.

---

### 11.6 histórico (v1.47)

**Aprovado para lançamento comercial com campanhas Ads.** Código Pixel/GTM e eventos de conversão prontos; configurar IDs no admin ou `.env` antes de rodar anúncios. Home com separação explícita comprador × organizador.

---

### 11.6 histórico (v1.46.1)

**Aprovado para lançamento comercial.** VPS **`d608169`** / v1.46 em produção (UX cadastro organizador + Turnstile). `pytest` **452** (CI). Turnstile operacional no VPS (§7 Ops fechado).

---

## 10. Changelog da spec

| Versão | Data | Mudanças |
|---|---|---|
| 1.50.9 | 2026-08-05 | **Auditoria pertinente.** §2.21: erro API produção; upload fail-closed; not-found/error; sitemap paginado; SSR/metadata produtor; twitter evento; robots; migrate_encryption CPF/TOTP; Next 16.3.0; gitignore graphify. Docs `15-auditoria-…`. |
| 1.50.8.3 | 2026-08-05 | **Fechamento /review.** Tip `main` **`266cb34`**; VPS **`e370a63`**. Rechecagem: docs 404 + `/ready` OK. Checklist §2.20/§7 **APROVADA**. |
| 1.50.8.2 | 2026-08-05 | **Deploy VPS v1.50.8 confirmado.** Tip produção **`e370a63`**. `/documentacao*`, `/openapi.json` → 404 no ar. Deploy Key SSH após repo privado. `/review` APROVADA. Merge PR #123 → `9db907d`. |
| 1.50.8.1 | 2026-08-04 | **Fechamento /review v1.50.8.** Tip `main` **`e370a63`** (PR #122 sobre #121). §7/§11: código×spec **APROVADA**; deploy VPS pendente na época. |
| 1.50.8 | 2026-08-04 | **Docs técnicas fora do site.** §2.20: remove `/documentacao*`, `openapi.json` público e link do rodapé; export OpenAPI só em `docs/openapi.generated.json`; sitemap/robots; teste `test_docs_nao_publicas.py`. Repo privado. Merge PR #121 → `dfabe91`. |
| 1.50.7 | 2026-08-04 | **Playbook Oficial de Marketing.** §2.19: `docs/14-playbook-marketing-eventosbr.md` — posicionamento (a EventosBR), proposta de valor, promessa *Organize melhor. Venda mais.*, pilares, Ciclo 1 (15 dias), Reels, Ads, e-mail, WhatsApp, KPIs e ciclos 2/3. Índice em `docs/README.md`. Sem mudança de código. |
| 1.50.6.1 | 2026-08-04 | **Fechamento /review.** Tip `46b470a`; §7/§11 atualizados; checklist home+navbar × produção **APROVADA**. `/build` sem lacuna (já na `main`). |
| 1.50.6 | 2026-08-04 | **Navbar correção.** Mantém Sobre visível (`shrink-0`); restaura CTA «Crie um evento» e nome no chip (reverte compactação da v1.50.5). `/review` APROVADA. |
| 1.50.5 | 2026-08-04 | Navbar densidade ao logar (parcialmente revertida na 1.50.6 — CTA/nome). |
| 1.50.4 | 2026-08-04 | **Navbar layout.** §2.16/§2.17: remove `flex-1` dos links em `lg+`; auth agrupado após menu (Login/conta + CTA); busca um pouco mais larga; reflow ao logar. Testes: 487 → 491. `/review` APROVADA. |
| 1.50.3 | 2026-08-04 | **Deploy VPS + fechamento.** §2.18 alinhamentos (home mobile-center; `/produtores` título mobile / parágrafo justificado). Tip produção `1dfd6aa`. E2E: seeds com e-mail confirmado + contato; cookie sessão usa `baseURL`. PR #101 fechada. `/review` APROVADA. |
| 1.50.2 | 2026-08-03 | **Hero full-bleed viewport.** §2.18: só a faixa do hero na largura da tela (`:has` + `data-home-hero-fullbleed`); demais seções no container. Testes: 486 → 487. |
| 1.50.1 | 2026-08-03 | **Hero claro + foto marketing.** §2.18: hero branco/verde com `hero-evento.webp` (stock Unsplash, trocar arquivo depois); copy v1.50 mantido. Testes: 485 → 486. |
| 1.50 | 2026-08-03 | **Home de lançamento.** §2.18: hero organizador; comprador secundário; features sem jargão; prova social com limiar; cenários no lugar de depoimentos fictícios; FAQ `/produtor`; preços. Testes: 480 → 485. `/review` v1.50 APROVADA. |
| 1.49.1 | 2026-08-03 | **Navbar + whitelabel escopo + ops disco.** §2.17: whitelabel só `/produtor`; busca sem travar; links contínuos. §7: tip `361eff7`; limpeza `docker builder prune` (68→5,8 GB). Testes: 479 → 480. `/review` v1.49.1 APROVADA. |
| 1.49 | 2026-08-03 | **Tema de marca proporcional.** §2.17: escala `--brand-50`…`950` no `<html>`; remapeamento `emerald-*`; apply imediato; logo 180×44. Testes: 475 → 479. `/review` v1.49 APROVADA. |
| 1.48.1 | 2026-08-03 | **Hotfix navbar.** §2.16: regressão após layout 2 linhas — dropdowns via portal (`z-80`); Sobre/Categorias fora de `overflow-x-auto`; menu conta único portal; E2E patamar navbar. `/review` v1.48.1 APROVADA. |
| 1.48 | 2026-08-03 | **UX admin + whitelabel + contato.** §2.16: e-mail duplicado; admin config (tamanhos, paleta cores); editar usuário; PDV sucesso; contato layout; marketing webp + `MarketingScreenshot`; navbar `lg+`; `TelefoneInput`. Testes: 474 → 475. |
| 1.47.4 | 2026-08-03 | **Sessão expirada → `/auth`.** §3.2.1: cookie `eventosbr_session_expired`, middleware e `api.ts` redirecionam login; `auth-client` força modo login. Testes: 470 → 474. |
| 1.47.3.1 | 2026-08-03 | **Deploy VPS v1.47 confirmado** — `915d2aa` API/Web; migração `000049`; `verificar-versao-site.sh` OK. §7 e §11 deploy PASS. |
| 1.47.3 | 2026-08-03 | **Fechamento pendências.** PR #99 MERGED → `main` `915d2aa`. §7/§11 atualizados; Turnstile v1.46 histórico PASS; deploy v1.47.2 e Pixel ops checklist explícitos. pytest 470 no §2.7/§7. |
| 1.47.2 | 2026-08-03 | **Admin config UX.** §2.15: classe `.input` global com bordas; painel configurações reorganizado; `ImagemAssetField` `compact`; fix `site-metadata` DEFAULT_PLATFORM_SETTINGS. Testes: 469 → 470. |
| 1.47.1 | 2026-08-02 | **Pixel/GTM no admin.** §2.14: `meta_pixel_id` + `gtm_id` em `platform_settings`; UI Admin → Marketing/anúncios; runtime IDs no frontend (`setMarketingRuntimeIds`); fallback env. Migração `20260802_000049`. Testes: 460 → 469. |
| 1.47 | 2026-08-02 | **Lançamento comercial — home dual + Ads/SEO.** §2.13: `HomeAudienciasDual`, `HomeProdutorFeatures`, FAQ; cards vitrine; wizard etapas; copy funcionalidades/sobre; Organization JSON-LD; og-image + marketing webp; noindex conta/organizador; Meta Pixel + GTM + eventos conversão. Testes: 452 → 460. |
| 1.46.1 | 2026-08-02 | **Deploy VPS v1.46 confirmado** pelo usuário — `d608169` em produção; Turnstile operacional (Managed). §7 e cabeçalho atualizados; PR #97 fechado (superseded). Teste CI: timeout worker contato mais robusto (45s). |
| 1.46 | 2026-08-02 | **UX cadastro organizador + Turnstile ops.** §3.3: tela pública dedicada após cadastro (`organizador-cadastro-pendente.tsx`, `/cadastro?confirmar=1`, sem login). §5.3: `configure-turnstile-env.sh`, `setup-turnstile-e2e.sh`, Spin scripts; widget `action=turnstile-spin-v2`, reset em erro; siteverify canônico. Testes Turnstile: 4 → 5. |
| 1.45 | 2026-08-02 | **Cadastro organizador + endurecimento imagens.** §3.3: confirmação e-mail 24h, boas-vindas com botão e link copiável, login bloqueado até confirmar, `reenviar-verificacao-cadastro`. §5.8: `imagem_url` só hosts da plataforma/R2/uploads; UI evento só upload. §5.3: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no build Docker. Testes: 445 → 449. |
| 1.44.3 | 2026-08-02 | **Deploy VPS confirmado** pelo usuário — `df08e23` / v1.44 em produção (`verificar-versao-site.sh`: API/Web `df08e23`, health/ready OK). §7 e cabeçalho atualizados; §11 deploy PASS. |
| 1.44.2 | 2026-08-02 | **Fechamento de pendências.** `main` `68bd595` (PR #92). §7: `baas`/CNPJ/`asaas_platform_cnpj` fechados por decisão ou N/A; §2.8 A/B fechados via 1ª venda; histórico §11 v1.33 alinhado. PR #87 fechado. Deploy VPS v1.44 pendente até confirmação. |
| 1.44.1 | 2026-08-02 | **Merge PR #91** — v1.44 na `main` (`733d227`, tip `6c2e031`). Spec §7 e cabeçalho; deploy VPS v1.44 pendente. |
| 1.44 | 2026-08-02 | **Auditoria pré-lançamento — recomendações implementadas.** §5.8 UX: `upload-imagem-tipos.ts` — `accept` e validação sem SVG/ICO em `ImagemAssetField`, `evento-imagem-field`, admin; `comprimir-imagem` rejeita vetor. §5.3: `checks.turnstile` em setup (`ok`/`recomendado`); `validar-go-live-vps.sh` avisa Turnstile. §11 `/review` v1.44 APROVADA. Testes: +3 (445). |
| 1.43.4 | 2026-08-02 | **Consolidação spec v1.43.3.** §11 alinhado à produção atual (`a665533`, deploy `d2c9e4b`, 442 testes); tabela `/review` v1.43.3; CI §7 pytest 442. |
| 1.43.3 | 2026-08-02 | **Deploy VPS confirmado** pelo usuário — `d2c9e4b` / v1.43 (vincular ingresso + favicon admin) em produção; §7 e cabeçalho atualizados. |
| 1.43.2 | 2026-08-02 | **Merge PR #86** — v1.43 na `main` (`7d6823d`, tip `a665533`). Spec §7 e cabeçalho atualizados; deploy VPS v1.43 pendente. Incorpora confirmação deploy `de12227` (PR #87 fechado por conflito). |
| 1.43.1 | 2026-08-02 | **Ops produção — `linked` até CNPJ + 1ª venda.** Decisão: manter `ASAAS_ONBOARDING_MODE=linked` (organizador cria/vincula conta no Asaas e preenche KYC lá); `baas` só quando plataforma tiver CNPJ na conta mãe. §2.8 C marcado validado (02/08/2026). §7 e cabeçalho alinhados; §2.8 A/B checklist opcional. |
| 1.43 | 2026-08-02 | **Self-service “vincular ingresso” (v1.43).** Comprador logado vincula ingresso confirmado à conta com código da carteirinha/e-mail (`POST /api/ingressos/vincular`); exige e-mail da conta = `participante_email`; rate limit `ingresso_vincular`. UI em `/conta/ingressos`. Fix UX admin: `accept` do favicon alinhado ao backend (sem SVG/ICO). Serviço `ingresso_vincular.py`. Testes: `test_ingresso_vincular.py`. 438 → 442. |
| 1.42.2 | 2026-08-02 | **`/review` v1.42.2 — build aprovada.** Revalidou tip `4125ff4` / 438 testes: §2.12 PDV v1.42 PASS; §5.8 XSS PASS; L1–L5 sem regressão; §11 atualizado (estava em v1.33/390). Rotas PDV documentadas em §2.12. Teste auth na busca PDV. 437 → 438. |
| 1.42.1 | 2026-08-02 | **Deploy VPS confirmado** pelo usuário — tip `4125ff4` / v1.42 (PDV confirmação/correção de e-mail) em produção; §7 e cabeçalho atualizados. |
| 1.42 | 2026-08-02 | **PDV — confirmação e correção de e-mail (v1.42).** Confirmação dupla de e-mail na venda; envio síncrono com fallback na fila; seção “Corrigir venda” (busca por nome/e-mail/telefone/CPF só do evento, `PATCH` reassocia `usuario_id`, `POST` reenviar com rate limit). Serviços: `conta_cliente.py`, `pdv_correcao.py`; `send_ticket_email_sync` aceita ingressos `pago`/`usado`. Spec §2.12 corrigida (ingresso na conta do comprador). **Pendente:** self-service comprador (“vincular ingresso”). Merge PR #81 (`fbe08a7`); tip produto `4125ff4`. Testes: `test_pdv_correcao_email.py`. 432 → 437. |
| 1.41.1 | 2026-08-02 | **Deploy VPS confirmado** pelo usuário — tip `b735902` / v1.41 (XSS rodada 1) em produção; §7 e cabeçalho atualizados. |
| 1.41 | 2026-08-02 | **Auditoria XSS — rodada 1 (bloqueia lançamento).** (1) **Crítico:** removidos SVG e ICO do upload (`asset_storage.py`, `assets.py`, `imagem_processamento.py`) — vetor de XSS armazenado via `/uploads` no mesmo domínio; só JPEG/PNG/WebP/GIF. (2) **Alto:** JSON-LD da página pública do evento escapado com `serializeJsonLdForScript` (`json-ld-html.ts`) antes de `dangerouslySetInnerHTML` — impede `</script>` em nome/descrição/local do organizador. Spec §5.8. Testes: `test_xss_auditoria_lancamento.py`. **Pendente UX:** `accept` do favicon no admin ainda menciona SVG/ICO (backend rejeita com 400). **Pendente auditoria:** PDV, locks, rate limits (rodadas seguintes). Merge PR #77 (`60c000d`); tip produto `b735902`. Testes: 428 → 432. |
| 1.40 | 2026-08-02 | **Bug real corrigido** (achado do usuário, confirmado no código antes de escrever o prompt): a página de impressão do ingresso (`GET /api/ingressos/{id}/download`) embutia a carteirinha padrão (já com nome do evento, data, local, participante e QR na própria imagem), mas envolvia isso num card HTML que repetia tudo de novo como texto solto (`<h2>` do evento, "Participante:", "Email:", "Data:", "Local:", "Assento:", badge de status). Corrigido: removida toda a duplicação, mantido só o essencial que a carteirinha não mostra (aviso de repasse, código da portaria, botão de imprimir). Teste novo confirma ausência dos rótulos duplicados **e** que nome/participante/local não aparecem em nenhum lugar do `<body>` fora da tag `<img>`. Validado também visualmente (renderização real do HTML em imagem) antes de aprovar — layout limpo, centralizado, consistente com o e-mail. Testes: 427 → 428. |
| 1.39 | 2026-08-01 | **Bug real corrigido**: `vender_ingresso_pdv` associava o ingresso à conta do ORGANIZADOR (`usuario_id=organizador.id`), não do comprador — o link "Ver ingresso na conta" no e-mail só funcionava se o organizador estivesse logado; o comprador de verdade nunca conseguiria acessar o próprio ingresso. Corrigido: cria/reaproveita uma conta cliente própria pro e-mail informado (mesmo padrão de colisão já usado em `compra_rapida`); conta nova recebe e-mail de "primeiro acesso". O link do e-mail do ingresso agora é decidido **a cada envio** pelo status real de senha do dono (`dono.senha_hash`), não só na criação — cobre também compras repetidas de contas ainda sem senha. **Carteirinha padronizada**: nova função central `montar_carteirinha_ingresso_bytes` usada no e-mail, no endpoint de download/impressão e num endpoint novo dedicado (`GET /api/ingressos/{id}/carteirinha`, só o dono) — elimina o QR "nu" que a tela de impressão usava antes, agora idêntica à imagem do e-mail em todo lugar. **Nota de processo**: o branch veio baseado num ponto do `main` anterior à auditoria UX (v1.38) — confirmei arquivo a arquivo que a diferença aparente era só desatualização, não reversão intencional, e apliquei via `cherry-pick` só o que era genuinamente novo, preservando os itens 1-4 da v1.38 intactos. Testes: 417 → 427. |
| 1.38 | 2026-08-01 | **Auditoria de UX competitiva** (20+ plataformas pesquisadas: Sympla, Eventbrite, Ingresse etc., cruzada com o código real). 4 itens implementados: (1) aviso obrigatório de documento (DNE/CIE) pra meia-entrada no checkout, conforme Lei 12.933/2013; (2) confirmação de e-mail do participante no checkout — supervisão encontrou que já havia proteção funcional real (`criarIntent` já bloqueava com `setError`+`return`), mas o botão "Finalizar compra" não refletia isso visualmente; corrigido pra desabilitar proativamente em mismatch de e-mail **ou CPF** (mesmo bug pré-existente no alerta de CPF, corrigido junto); (3) modo offline no check-in da portaria (MVP) — pré-carrega IDs válidos, distingue falha de rede de rejeição real do servidor, marca localmente como usado pra evitar double-checkin mesmo offline, sincroniza automaticamente ao reconectar; (4) retry automático com backoff em falha de pagamento — supervisão verificou que o mecanismo de não-duplicar-cobrança já existia (reaproveita/cancela `asaas_payment_id` pendente antes de recriar), a alegação do comentário ("chave de idempotência") era tecnicamente imprecisa mas o efeito prático é real. Um quinto item (checkout de convidado) foi avaliado e **deliberadamente não implementado** — mantém login obrigatório, é decisão de produto que precisa de mais discussão. Testes: 402 → 417. |
| 1.37 | 2026-08-01 | **Consolidação `/build`+`/review`**: revisão ativa encontrou e corrigiu 3 inconsistências (mesmo padrão dos ciclos L1-L5 anteriores) — cabeçalho ainda apontava pra v1.35/`d8f3b4b` quando o `main` já tinha v1.36 (e-mail obrigatório no PDV, revisado e aprovado: exige e-mail válido pois o ingresso de PDV vai pro `usuario_id` do organizador, sem conta de cliente associada — sem e-mail o comprador não teria como receber o ingresso; `enqueue_ticket_email` chamado incondicionalmente agora) mais um PR de configuração de ambiente (Cursor Cloud Agent, sem impacto em produto); contagem de testes desatualizada (400→402); confirmação de deploy travada em `a32b948`, marcada novamente como pendente de reconfirmação (PDV+assentos+e-mail obrigatório entraram depois sem confirmação registrada). 402/402 (2x), tsc/eslint/build limpos. |
| 1.36 | 2026-08-01 | **Fix: e-mail obrigatório no PDV presencial.** Bug real: e-mail do participante era opcional na venda PDV e o envio de carteirinha era condicional (`if email:`) — diferente do checkout online (onde o e-mail é opcional só porque cai na conta logada do comprador), no PDV o ingresso vai pro `usuario_id` do organizador, sem conta de cliente associada, então sem e-mail o comprador não tinha nenhuma garantia de receber o ingresso. Corrigido: `vender_ingresso_pdv` e `PdvBody` agora exigem e-mail válido (mesma checagem leve `"@" not in email` de `lista_espera.py`), `enqueue_ticket_email` passou a ser chamado incondicionalmente após a venda, e a UI do PDV marca o campo como obrigatório. §2.12 atualizada. |
| 1.35 | 2026-07-31 | **PDV + assentos MVP mesclado no main**, após supervisão completa (migração, trava atômica, bypass de gateway, autorização — tudo confirmado correto). **Achado crítico da supervisão**: o teste de concorrência real (duas threads, mesmo assento) falhava não por bug de produção, mas porque toda a suíte roda em SQLite em memória e o dialeto SQLite descarta silenciosamente `FOR UPDATE` — rodado 5x contra Postgres real, a lógica passa sempre. Corrigido com um fixture que troca o banco pra Postgres real só nesse teste (`DATABASE_URL_TESTE_CONCORRENCIA`, pula com aviso se não configurada); CI ganhou serviço Postgres pra isso nunca mais passar despercebido. Revela que a trava de capacidade de lote pré-existente nunca tinha sido verificada sob concorrência real — este foi o primeiro teste desse tipo em todo o sistema. |
| 1.34 | 2026-07-31 | **PDV presencial + assentos nomeados (MVP).** §2.12: venda presencial (`canal_venda=pdv`, sem Asaas/split); lotes com lista de assentos + select no checkout + claim FOR UPDATE; assento na carteirinha/relatórios. Migração `000048`. Testes: 390 → 400 (`test_pdv_presencial.py`, `test_lote_assentos.py`). Fora de escopo: maquininha, mapa visual, preços por setor. |
| 1.33 | 2026-07-31 | **`/review` independente — build aprovada.** Revalidou tip `a32b948` / 390 testes: L1–L5 PASS; §2.9–§2.11 PASS; restos L4/L5 confirmados fechados no código e no corpo da spec. Atualizou §11 (tabelas v1.31 que ainda diziam FAIL) e tip de deploy §7 → `a32b948`. Sem correções novas para `/build`. Ops §2.8 A–C seguem `[ ]`. |
| 1.32 | 2026-07-31 | **`/review` aprovada.** L4 fechado: §2.2/§2.3/§2.4/§4 reescritos — texto ainda tratava `linked` como só-dev/fora-de-escopo, contradizendo o cabeçalho da spec e o código real (`evento_repasse.py` confirma que `linked` libera venda em produção via `status_repasse_aprovados()`). Achado extra durante a correção (fora do diagnóstico original): linha 134 tinha a mesma contradição, corrigida junto. L5 fechado: docstring de `deletar_evento` desatualizada (dizia só "pago ou pendente", o código já bloqueava `usado` desde o L1). 390/390, sem mudança de lógica de negócio. |
| 1.31 | 2026-07-31 | **`/review` — build NÃO aprovada.** Tip produto `9082c90`, pytest **390**. L1 DELETE+`usado` **confirmada no código**. L2 só parcial: restos em §2.2/§2.3/§2.4/§4 (**L4**) + docstring API (**L5**). Correções para `/build` em §11.5. Contagens tip/§7 atualizadas. |
| 1.30 | 2026-07-31 | **`/review` — build NÃO aprovada.** §2.10–§2.11 passam com **L1** (DELETE não bloqueia ingresso `usado` embora UI e “vendido” incluam check-in). **L2** contradições baas↔linked no corpo da spec vs tip/`onboarding-linked-lancamento.md`/código. **L3** tip de deploy citava SHA docs. Correções para `/build` em §11. Ajuste pontual §2.11 (nota do fix `/workspace`) e §7 Validado VPS (`linked`). pytest 389. |
| 1.29 | 2026-07-31 | **Auditoria de segurança/UI/SEO feita a pedido do usuário** (checklist de 9 itens contra o código real): confirmado que 8 já estavam bem implementados (CSP com nonce+strict-dynamic, validação de webhook com `compare_digest`, criptografia de segredos com salt por registro, skeletons calibrados, validação de cartão com mensagens claras antes de submeter, portaria com "modo festa" pra baixa luminosidade, JSON-LD Event completo, WebP client+server) — rotação automática de chave de criptografia avaliada e **descartada de propósito** (risco maior que benefício nessa escala; mecanismo manual já existente é a escolha certa). **2 gaps reais implementados**: metadata dinâmica por cidade em `/eventos?cidade=` (combinando com categoria quando os dois existem) e `typicalAgeRange` no JSON-LD quando `classificacao_etaria` está preenchida. **Bug real encontrado e corrigido na supervisão**: teste novo tinha um caminho absoluto fixo (`/workspace`) no `subprocess.run` que só funcionava por coincidência num ambiente específico — 8 de 10 testes falhavam em qualquer outro lugar; corrigido removendo o `cwd` fixo (mesmo padrão de caminho relativo já usado no resto da suíte). Testes: 379 → 389. |
| 1.28 | 2026-07-31 | **SEO** (`8b6759c`): metadata dinâmica em `/eventos?cidade=` (e combinação natural com categoria); `typicalAgeRange` no JSON-LD schema.org/Event a partir de `classificacao_etaria` (formato `0-`/`12-`/`16-`/`18-`). Spec §2.11. Testes: 379 → 389 (`test_seo_cidade_typical_age.py`). |
| 1.27 | 2026-07-31 | **Zero erros de lint no projeto** (antes: 10 erros pré-existentes, mesmo arquivo, várias sessões sem correção). `organizador-panel-views.tsx` mutava/lia um ref diretamente no corpo do render (viola regra do React) — trocado por `useState` + cálculo derivado no render (só leitura) pra não perder o efeito "sem flash na primeira visita à aba"; `useEffect` só persiste no estado pra lembrar nas trocas seguintes. `eventos-lista-publica.tsx`: 4 refs (`filtroData`/`dataDe`/`dataAte`/`buildUrl`) alinhados ao mesmo padrão `useEffect` que já era usado corretamente pros outros refs do mesmo arquivo. **Verificação de impacto feita antes de enviar**: rastreamento manual do teste e2e de troca de abas do painel (Eventos→Financeiro→Relatórios→Eventos), confirmação de que as demais mutações de ref no arquivo de eventos acontecem dentro de handlers (seguro), e que a interface pública de `OrganizadorPanelViews` (só recebe `children`) ficou inalterada. Build (2x) + 379/379 testes, sem regressão. |
| 1.25.1 | 2026-07-31 | **Aceite §11 fechado** (`1b15985`): A1 teste `cancelado` sem lembrete; B1 `POST /pagamentos/criar` + `ref`; B2 isolamento cross-org promoters; B3 share público sem `?ref=`; B4 `localStorage` TTL 24h + `limparRefPromoter`; C1 galeria no criar; C2/C3 visibilidade e PATCH cross-org. Spec §2.9 / plano §7–§11 **aprovados**. Testes: 359 → 367. |
| 1.25 | 2026-07-30 | **Carrinho abandonado + promoters + galeria** (plano aprovado): lembrete transacional único aos 20 min via fila confiável; links `?ref=` com painel agregado sem comissão/PII; galeria 0–6 fotos reais no Sobre. Migração `000046`. Spec §2.9. Testes: 347 → 359 (inclui harden do claim atômico). Review intermediário apontou lacunas §11 (fechadas em 1.25.1). |
| 1.24 | 2026-07-30 | **Bug Financeiro**: ingresso grátis/cortesia (R$0) aparecia com taxa EventosBR fantasma (R$2 fixo por ingresso no ledger) porque `detalhar_taxa_ingresso(0)` não zera a taxa fixa — alinhado a `taxa_ingresso`; espelho no frontend; backfill `corrigir_taxa_ingressos_gratis` (API pública em `__all__`, sem import de helper privado em `relatorios.py`) em saldo/extrato/vendas/relatórios. Spec §2.1.1. Testes: 343 → 347 (`test_taxa_ingresso_gratis.py`). |
| 1.23 | 2026-07-30 | **Item 2 do plano concluído**: home separa claramente "Comprar ingresso" (hero principal, foco no comprador) de "Sou produtor" (faixa dedicada com a mesma promessa de `/produtores`) — sem enfraquecer a experiência de quem só compra. Scroll-reveal (Fase 1) estendido pra home, `/funcionalidades` e `/sobre`; micro-celebração do checkout trocou o "✓" de texto por um ícone SVG (animação já existente, `.checkout-check-pop`, mantida). Contadores da home (`CountUp`, eventos/ingressos publicados) confirmados usando dados reais da API, com fallback correto quando não há dados. Também: normalização de Instagram/WhatsApp no rodapé (aceita @usuario, número com DDD, não só URL completa) e correção de cache stale no `revalidateTag` do Next 16. Testes: 335 → 343. |
| 1.22 | 2026-07-30 | Início do plano pré-lançamento de posicionamento (`specs/plano-pre-lancamento-posicionamento-animacao.md`): página **"Para produtores"** (`/produtores`) — resolve o "gap principal" de uma análise competitiva (10+ concorrentes/referências) feita em conjunto com o Cursor: produto forte (taxa clara, repasse, whitelabel, operação completa) mas mal empacotado/vendido pro organizador. Linkada no navbar, rodapé e sitemap. **Fase 1 do plano de animação**: `ScrollRevealObserver` (Intersection Observer nativo, sem Framer Motion/GSAP), classes `.reveal`/`.reveal-visible`, respeita `prefers-reduced-motion` (critério de acessibilidade do Lighthouse). Também: limpeza no GitHub (3 PRs stale fechadas, 128 branches remotos apagados, preservados os 2 de backup). Testes: 332 → 335. |
| 1.21 | 2026-07-30 | Revisão de 6 commits feitos com o Cursor em sessão paralela (usuário confirmou os valores contra o painel real do Asaas — bate certinho): **acréscimo de parcelamento agora embute o custo de antecipação** (1,25% à vista / 1,70% a.m. parcelado), não só o delta de processamento — equaliza a margem líquida do organizador e da plataforma entre à vista e parcelado (antes, parcelar literalmente custava dinheiro pra plataforma/organizador sem compensação); botão "verificar/ativar antecipação automática" no Financeiro do organizador, sem custo EventosBR; bloco "Solicitar saque" sempre visível (formulário ou motivo da indisponibilidade); link âncora direto pro saque. Consolidadas pendências locais: `selectinload(Evento.organizador)` também nas rotas de listagem (antes só a rota de detalhe carregava, então `organizador_nome` vinha vazio em listagens); mais correções PT-BR em termos/admin (aceder→acessar, utilizadores→usuários, respetiva→respectiva, "mantém-se... no que respeita"→"permanece... no que diz respeito", "contacto"→"contato"); seção 9 dos Termos ("Contato") corrigida pra sempre linkar `/contato` em vez de `/sobre`. Testes: 327 → 332. |
| 1.20 | 2026-07-29 | **Política de privacidade revisada** após pesquisa de como a Sympla estrutura a própria (LGPD exige canal de contato do encarregado/DPO publicado de forma clara). Achados reais corrigidos: vocabulário de português europeu misturado com o resto do site PT-BR ("contacto"→"contato", "utilizador"→"usuário", "recolhemos"→"coletamos", "registo"→"registro", "partilha"→"compartilhamento", "alojamento"→"hospedagem", "detetar"→"detectar", "palavra-passe"→"senha" — mesmos termos corrigidos em `documentacao/page.tsx`); texto com cara de rascunho não finalizado removido; beco sem saída real (política mandava pra `/sobre` "exercer direitos", mas essa página só tem conteúdo de marketing, sem contato nenhum) — corrigido, tudo aponta direto pro `/contato` agora, incluindo uma seção final dedicada. **Rodapé**: link "Desenvolvido por InoveSW" apontava pro domínio errado (`invesw.com.br`, faltando o "o") — corrigido pra `inovesw.com.br`; removido sublinhado dos links "EventosBR" e "InoveSW" (continuam funcionais). **Evento**: texto "Sobre o evento" agora justificado, consistente com o resto do site; seção "Organizador" (nome/e-mail/telefone) já estava distribuída em 3 colunas na ordem certa, confirmado sem necessidade de mudança. |
| 1.19 | 2026-07-29 | **P18**: página do evento não mostrava nome/e-mail/telefone do organizador (dados coletados como obrigatórios na criação, mas nunca exibidos) — nova seção "Organizador" após o mapa; `organizador_nome` também faltava no tipo TypeScript do frontend. **Bug real**: "Ler descrição completa" duplicava o início do texto ao expandir (resumo truncado ficava visível acima do texto completo, que recomeçava do zero) — trocado `<details>` nativo por toggle controlado em React. **Bug real**: link "Fale conosco" da página do evento caía em `/sobre` (fallback quando `NEXT_PUBLIC_EMAIL_CONTATO` não configurada) em vez de ir pro formulário `/contato` de verdade — corrigido pra sempre ir pro `/contato`. **E-mail do ingresso**: QR nu (200×200, sem nenhum texto) trocado por uma carteirinha completa (nome do evento, data/hora, local, QR de 280px e nome do participante numa imagem só, ~45KB) — se a pessoa salvar só a imagem pra mostrar na entrada, não perde o contexto. Exige `fonts-dejavu-core` na imagem Docker da API (Pillow precisa de uma fonte TrueType). Testes: 322 → 326. |
| 1.18 | 2026-07-29 | **E-mail “enviado” que não chegava**: worker de contato/e-mail simples descartava a mensagem da fila após falha SMTP **sem retry** (UI já tinha confirmado recebimento). Corrigido: retry com limite (`TICKET_EMAIL_MAX_ATTEMPTS`), Redis deixa de cachear falha de conexão pra sempre (retry em 15s), SMTP off deixa de retornar sucesso falso em ingresso/e-mail simples, formulário `/contato` deixa de dizer “enviada” (usa “recebida”). Página de evento P17 (A+B) mergeada. |
| 1.17 | 2026-07-29 | **Página pública do evento (P17) — fases A+B**: anti-repetição (meta única quando/onde; preço/lote só na zona de compra sticky; Sobre = descrição; urgência só no checkout; reembolso uma vez) + prova social (“X pessoas já garantiram lugar”), barra de restante do lote, compartilhar WhatsApp/copiar link/`navigator.share`. Componentes: `evento-compartilhar.tsx`, `evento-meta-unica.tsx`; removido `evento-resumo-rapido.tsx`. Spec de proposta atualizada. |
| 1.16 | 2026-07-29 | `/review` completo encontrou e `/build` corrigiu 8 lacunas: (1) CI do job `api` sem Redis causava 15 erros em testes de fila confiável — adicionado serviço Redis no workflow (2.7); (2) **regressão real do P16** (mapa embutido) reintroduzida por um commit anterior — restaurado o iframe sempre visível com fallback `?output=embed`, validado manualmente; (3) **bug real** em `export-openapi.py`: sanitização de white-label nunca alcançava o corpo das operações (summary/description dentro de `paths`) por falta de recursão — corrigido, e nomes de schema com a marca do provedor também renomeados (3, 2.6.3); (4) `ticket_email.py`, `notificacao_email.py`, `lembrete_evento.py`, `assinatura_email.py` e `marketing_email.py` migrados para o cliente SMTP compartilhado com fallback SSL/STARTTLS (2.6.6); (5) workers de e-mail simples e de contato agora iniciam no boot da API, não só no primeiro envio (2.6.6); (6) admin-integrado-usuario.md §3.2: cliente-admin sem tipo organizador não via a seção de ativação de 2FA na UI — corrigido; (7) admin-integrado-usuario.md §3.5: item "Administração" no menu, sem 2FA ativo, ia direto pra tela de colar chave em vez de orientar a ativação — corrigido com redirecionamento pra `/conta/perfil?ativar_2fa_admin=1` (ou `/organizador/perfil`) com banner explicativo; (8) admin-integrado-usuario.md §3.4/§4: aviso de confirmação ao remover o próprio acesso admin agora é específico (antes era o mesmo texto genérico usado pra remover qualquer usuário), e novo teste automatizado cobre o bloqueio imediato do painel após desativar o próprio 2FA. Testes: 318 → 322. Todos os itens validados manualmente (mapa embutido, fluxo de 2FA admin, aviso de auto-remoção) via `computerUse` em ambiente local. |
| 1.15 | 2026-07-28 | Mapa da página de evento (`EventoMapaLocal`) sempre embutido (P16) — dependia de `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` estar configurada pra mostrar o iframe (nunca esteve, em produção), mostrando só o link "Abrir no Google Maps". Corrigido usando o formato de embed sem chave de API (`?output=embed`) como padrão. Formulário de criar/editar evento não precisou de mudança (só campos de texto local/cidade). |
| 1.14 | 2026-07-28 | **Bug real corrigido**: `/contato` tratado como rota protegida (`startsWith("/conta")` casava por coincidência de string com `/contato`) — visitante deslogado era redirecionado pro login ao clicar "Fale conosco" (3.2). Destino pós-login revertido pra `/organizador/eventos` (não mais `/admin/dashboard` pra contas admin). `/admin/dashboard` ganhou menu lateral (`AdminShellWrapper`) e não mostra mais flash da tela de "colar chave" antes de confirmar a sessão. **Causa raiz do e-mail não chegar, encontrada e corrigida**: `EMAIL_USER`/`EMAIL_PASSWORD` eram de contas diferentes (`noreply@` vs senha de `contato@`) — autenticação SMTP sempre falhava (2.6.5). E-mail de confirmação ao remetente do "Fale conosco" implementado. |
| 1.13 | 2026-07-28 | **Incidente resolvido**: migração órfã (`20260728_000045`, de um branch paralelo nunca mergeado que aplicou schema direto na VPS compartilhada) travava todo deploy — sincronizada. Incorporado seletivamente desse mesmo branch: SMTP com SSL/fallback (porta 465 Hostinger), correção de senha com `#` sendo cortada no `.env`, e persistência do formulário de contato no banco (2.6.3). **Novo**: e-mail do formulário `/contato` agora é assíncrono (2.6.4) — antes a tela travava até ~90s esperando o SMTP synchronamente; agora responde em <1s e o envio acontece em segundo plano com a mesma fila confiável de 2.6.2. ⚠️ Senha real de e-mail encontrada exposta num script do branch paralelo (recomendado rotacionar). Testes: 310 → 317. |
| 1.12 | 2026-07-28 | **Dois bugs reais de e-mail "perdido silenciosamente" corrigidos** (2.6.2): `notificacao_email.py` fazia `.decode()` num valor que o Redis já devolve como string (`AttributeError` engolida pelo `except` genérico — todo e-mail de onboarding/saque/lista de espera/interesse enfileirado via Redis se perdia); `ticket_email.py` perdia o e-mail do ingresso se o container reiniciasse no meio do envio (`brpop` destrutivo). Corrigido com padrão de fila confiável (`blmove` + lista `processing` + recuperação de órfãos ao reiniciar o worker) nos dois arquivos. Incidente documentado à parte (2.6.1): token do webhook Asaas dessincronizado entre `.env` e painel Asaas, causando 401 por horas — token não sincroniza automaticamente, precisa copiar manualmente dos dois lados quando um muda. Testes: 300 → 310. |
| 1.11 | 2026-07-28 | **Admin integrado à conta do usuário** (login normal + 2FA, `is_platform_admin`, chave estática vira só emergência — spec dedicada `specs/admin-integrado-usuario.md`). "Lembrar dispositivo" (30 dias sem novo desafio 2FA). Menu do site unificado (cliente via o mesmo menu que organizador/deslogado, antes só via "Eventos"). Conversão cliente→organizador sem criar conta nova (`/api/auth/tornar-organizador` + card em Perfil). Contato (telefone/e-mail) obrigatório na criação de evento; telefone nas Configurações da plataforma; formulário público `/contato`. Compressão/redimensionamento de imagem no navegador e no servidor (Pillow). Rodapé reorganizado + botão de voltar ao topo. **Correção definitiva de uma investigação longa** ("Not Found" persistente no painel admin): rewrite genérico `/api/*` engolindo rotas do próprio Next.js + glob `**` não suportado pelo matcher `path` do Caddy 2 — ver 5.1.2 para não repetir. Testes: 265 → 300. |
| 1.10 | 2026-07-25 | `/review` final: onboarding `linked` validado em produção (deploy `e6df57d`, todas verificações OK). Fix adicional: scroll não resetava ao topo no painel organizador/conta (gap entre `AppNavLink scroll={false}` e exclusão do `ScrollToTop`). CNPJ da conta mãe reclassificado de "bloqueio de lançamento" para "pendência futura" (só necessário para reativar `baas`). |
| 1.9 | 2026-07-25 | Modo `linked` liberado para produção (sem exigir CNPJ) — ver spec dedicada `specs/onboarding-linked-lancamento.md`. Correção de regressão: `loading.tsx` global reintroduzia flash de navegação já resolvido anteriormente (revertido). |
| 1.8 | 2026-07-24 | Auditoria completa de segurança/SEO/UX: 2FA (organizador+admin), CAPTCHA Turnstile, cifra `enc:v2` de CPF/CNPJ, correções TOCTOU/webhook/CSV-injection, SEO técnico (JSON-LD, sitemap dinâmico, canonical), indicador de força de senha. Fechadas 29 PRs obsoletas cujo conteúdo já estava incorporado à `main`. Testes: 241 → 265. |
| 1.7 | 2026-07-22 | Versão anterior (conta de recebimento BaaS, onboarding tracker, white-label de mensagens). |

**Regra a partir da v1.8:** qualquer mudança relevante no código (nova feature, correção de segurança, mudança de contrato de API) deve vir acompanhada de uma atualização desta spec no mesmo commit/PR, com nova linha no changelog acima.
