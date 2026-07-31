# Spec: EventosBR — Produção, produto e pagamentos

**Versão:** 1.27
**Data:** 2026-07-31
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

> **Documento único** de referência para publicação do sistema. Substitui `repasse-asaas-pagamentos.md` e `patamar-completo-ux-produto.md`.
>
> **Produção (VPS):** tip de **produto** da `main` em `eea493d` — v1.26 (ficha técnica + WhatsApp /contato + duplicar/deletar; ver §2.10). Tip de **docs/spec**: HEAD da `main` após commits `docs(spec): …`. `pytest` total **379**. v1.25.1 (§11) permanece aprovada. **Supervisão independente confirmada** (2026-07-31): revisei a regra de segurança do DELETE (bloqueia com ingresso pago/pendente, `_evento_do_organizador` garante só o dono, cascade delete-orphan já configurado em todas as relações do Evento — sem risco de erro de integridade referencial); CTA de WhatsApp em `/contato` reaproveita `social_whatsapp_url` já normalizado, some se não configurado; migração `000047` validada upgrade→downgrade→upgrade. 379/379 rodado 2x, estável. `tsc`/`eslint`/build limpos (mesmos 10 erros pré-existentes, arquivo não tocado). **Deploy VPS:** `cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh` (aplica migração `000047`). **Onboarding de pagamentos:** modo `linked` desde 25/07/2026 — ver `specs/onboarding-linked-lancamento.md`. CNPJ da conta mãe pendente; **não bloqueia lançamento**; só para reativar `baas` no futuro.
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

**Deletar:** `DELETE /api/eventos/id/{id}` só para o dono; bloqueado se houver ingresso `pago` ou `pendente` (erro sugere despublicar); UI com confirmação explícita; com vendas o botão fica desabilitado com explicação.

Testes: `test_evento_ficha_tecnica.py`, `test_contato_whatsapp_cta.py`, `test_evento_duplicar_deletar.py`.

### 2.2 Conta de recebimento do organizador (modelo de produção)

**O organizador não cria nem vincula conta em painel externo.** Tudo ocorre dentro do EventosBR:

1. Organizador → **Financeiro** → **Criar conta de recebimento**.
2. Formulário na plataforma (CPF/CNPJ, endereço, telefone, renda, data de nascimento quando PF).
3. Backend provisiona a **conta de recebimento** do organizador (PF ou PJ) via API do processador (`POST /v3/accounts` — rota pública `POST /api/organizador/asaas/conta-recebimento`; alias legado `/asaas/subconta`).
4. KYC/análise → status `approved` libera publicação e venda.
5. Repasses caem na conta de recebimento do organizador via split; **saques Pix** são solicitados na plataforma (white-label).
6. Extrato, vendas e conciliação na área **Financeiro** do organizador.

**Conta mãe da plataforma (operação):** a chave `ASAAS_API_KEY` do EventosBR deve pertencer a uma conta **pessoa jurídica (CNPJ)** no processador. Sem isso, o provisionamento de contas de recebimento dos organizadores é bloqueado pelo processador (limitação BaaS). Organizadores podem ser **PF (CPF)** ou **PJ (CNPJ)** — o bloqueio não é do CPF do organizador, e sim da conta mãe da plataforma.

**Terminologia (UX e spec):** usar sempre **conta de recebimento** ou **conta de repasses**. Não expor “subconta”, “Asaas” nem “vincular wallet” ao usuário.

**Acompanhamento dinâmico (tracker):** após criar conta ou iniciar assinatura, UI exibe stepper com polling (`GET /api/organizador/onboarding/conta/{trackingId}/status` e `GET /api/organizador/onboarding/assinatura/{subscriptionId}/status`, intervalo ~4s). E-mails automáticos no backend em `APPROVED`/`REJECTED` (conta) e `SUBSCRIBED`/`PAYMENT_FAILED` (assinatura). Componente reutilizável: `frontend/src/components/status-tracker.tsx`.

**Modo de produção obrigatório:** `ASAAS_ONBOARDING_MODE=baas` (único modo em produção).

### 2.3 Configuração Asaas — somente produção

Em **produção** (`ENVIRONMENT=production`):

| Variável | Valor fixo | Observação |
|----------|------------|------------|
| `ASAAS_ENVIRONMENT` | `production` | Chaves `$aact_prod_...`; **não alterar** |
| `ASAAS_ONBOARDING_MODE` | `baas` | Conta de recebimento criada pela plataforma |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` | Sem colar walletId manualmente |
| `ASAAS_DISABLED` | `false` | Pagamentos reais ativos |

A conta Asaas vinculada a `ASAAS_API_KEY` deve ser **CNPJ** (conta mãe da plataforma) para provisionar contas de recebimento dos organizadores. Verificação: `GET /api/admin/setup` → `checks.asaas_platform_cnpj`.

Credenciais Asaas (`ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`) são de **produção**, configuradas uma vez no `.env` do VPS e **não devem ser trocadas** em operação normal. Backups: `backup-prod-env.sh` / `restore-prod-env.sh`.

`config/settings.py` → com `ENVIRONMENT=production`, `asaas_env()` retorna sempre `production` (sem inferência sandbox).

Modos `linked` e `both` existem apenas no código para desenvolvimento legado — **fora do escopo de produção** e desta spec.

### 2.4 Status que liberam venda

`app/services/evento_repasse.py` → em produção: **`approved`** (conta de recebimento aprovada).

Status `manual` e `linked` aplicam-se só a ambientes de desenvolvimento com flags explícitas — não usados em produção.

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
| `api` | `pytest` (379 testes) — job roda com serviço Redis (`redis:7-alpine`) desde v1.16, senão os testes de fila confiável (`test_fila_email_*_confiavel.py`) falham por falta de Redis |
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

### 3.2 Correções de roteamento e painel admin (v1.14)

- **Bug real**: `/contato` era tratado como rota protegida — a checagem usava
  `pathname.startsWith("/conta")` puro, e `/contato` **também começa com essas
  letras** ("conta" + "to", coincidência de string, não de rota). Visitante
  deslogado clicando em "Fale conosco" caía em `/auth?next=/contato`. Corrigido
  em dois lugares (`proxy.ts` middleware e `lib/api.ts` redirecionamento de
  sessão expirada) com checagem de limite de segmento:
  `pathname === "/conta" || pathname.startsWith("/conta/")`.
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

**Fora do escopo desta publicação:** múltiplos operadores, formulário custom inscrição, importação CSV, certificados, PWA equipe, Apple/Google Wallet, NFSe automática, modo `linked`/`both`, sandbox Asaas em produção.

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

Opt-in via `TURNSTILE_SECRET_KEY` (API) + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend); desligado por padrão, não bloqueia nada se não configurado. Verificação server-side em `app/services/turnstile.py`, aplicado em `/api/auth/{login,registrar,solicitar-recuperacao-senha}`. Widget: `frontend/src/components/turnstile-widget.tsx`.

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

---

## 6. Variáveis de ambiente (produção)

| Variável | Obrigatório | Valor em produção |
|----------|-------------|-------------------|
| `ASAAS_API_KEY` | Sim | Chave `$aact_prod_...` — **não alterar** |
| `ASAAS_PLATFORM_WALLET_ID` | Sim | Wallet da plataforma — **não alterar** |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Token do webhook — **não alterar** |
| `ASAAS_ENVIRONMENT` | Sim | **`production`** (fixo) |
| `ASAAS_ONBOARDING_MODE` | Sim | **`baas`** (fixo) |
| `ASAAS_ALLOW_MANUAL_WALLET` | Sim | **`false`** (fixo) |
| `ASAAS_DISABLED` | Sim | **`false`** |
| `SECRET_KEY` | Sim (≥ 32 chars) | |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Sim | |
| `PLATFORM_ADMIN_API_KEY` | Sim | |
| `CORS_ORIGINS` | HTTPS, sem `*` | |
| `FRONTEND_PUBLIC_URL` | URL pública | |
| `POSTGRES_PASSWORD` | Sim | |

Checks: `production_checks.py` → `GET /api/admin/setup`. Em produção valida:

- `ASAAS_ENVIRONMENT=production`
- `ASAAS_ONBOARDING_MODE=baas`
- `ASAAS_ALLOW_MANUAL_WALLET=false`
- `ASAAS_DISABLED=false` (check `asaas_payments_enabled`)
- Conta mãe Asaas **CNPJ** em modo `baas` (check `asaas_platform_cnpj`)
- Senha Postgres, `CORS_ORIGINS` só HTTPS, `FRONTEND_PUBLIC_URL` preenchida

Bloqueia `ready_for_production` se qualquer check crítico estiver `pendente`.

---

## 7. Critérios de conclusão para publicação

### Pagamentos (código)

- [x] Split só para organizador; taxa na conta emissora
- [x] Conta de recebimento criada pela plataforma (`ASAAS_ONBOARDING_MODE=baas`)
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

- [x] `pytest` verde (379 testes)
- [x] `npm run build` verde
- [x] CI `api`, `web`, `e2e`, `e2e-compra`, `e2e-asaas`, `prod-compose` configurados em `.github/workflows/ci.yml`; job `api` roda com serviço Redis desde v1.16 (antes falhava com 15 erros nos testes de fila confiável por falta de Redis no runner)
- [x] Teste mock compra + split: `scripts/test-compra-split-mock.sh`
- [x] OpenAPI exportado sem paths `subconta` (`export-openapi.py` white-label)
- [x] API status usa só `tem_conta_recebimento` / `permite_conta_recebimento` (sem aliases legados)
- [x] Checkout: código `repasse` + aviso proativo antes do pagamento (`compra_indisponivel_codigo`)

### Operação (VPS — após deploy + CNPJ Asaas)

**Estado do repositório:**

- [x] tip de produto v1.26 — `eea493d` (ficha técnica + WhatsApp /contato + duplicar/deletar; §2.10); §11 v1.25.1 em `1b15985`. Hash = último commit de produto; commits `docs(spec): …` não entram neste ponteiro.
- [ ] Conta mãe Asaas em **CNPJ** *(segue pendente — não bloqueia mais o lançamento, ver nota de topo; necessário só para reativar `baas` no futuro)*
- [x] Deploy VPS com o commit `e6df57d`: confirmado rodando em produção (25/07/2026)
- [x] Migration `20260724_000042_encrypt_cpf_cnpj_repasse` aplicada em produção (confirmado no log de deploy)
- [x] Onboarding `ASAAS_ONBOARDING_MODE=linked` ativo e validado em produção (fluxo de vínculo de conta testado e funcionando)
- [ ] `GET /api/admin/setup` → `asaas_platform_cnpj` *(não aplicável em modo `linked` — só relevante quando/se voltar a `baas`/`both`)*

**Validado no VPS em produção (deploy `e6df57d`, 25/07/2026 — todas as verificações OK):**

- [x] `.env` produção preenchido
- [x] `ASAAS_ENVIRONMENT=production` e `ASAAS_ONBOARDING_MODE=baas`
- [x] `verify-production.sh` / `verificar-versao-site.sh`
- [x] Webhook token HTTP 200 (`test-asaas-webhook.sh --expect-ok`) — revalidar após trocar conta Asaas

**Pendente — testes reais (§2.8) — após CNPJ e deploy:**

```bash
cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh
```

- [ ] Webhook configurado e testado com evento real (`PAYMENT_RECEIVED`) — §2.8 A
- [ ] SMTP + SPF/DKIM validados (envio real de ingresso) — §2.8 B
- [ ] Primeira venda real validada (PIX ou cartão + e-mail recebido) — §2.8 C

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
| White-label | `api-errors.ts`, `mensagens_publicas.py`, `documentacao/api/page.tsx`, `export-openapi.py` |
| 2FA (organizador + admin) | `services/totp.py`, `services/organizador_2fa.py`, `components/seguranca-2fa.tsx`, `lib/admin-totp.ts`, `app/api/admin/session/route.ts` |
| Admin integrado à conta | `deps/platform_admin.py`, `routes/admin.py` (`/usuarios/{id}/admin`), `scripts/set_platform_admin.py`, `components/tornar-organizador-card.tsx`, `specs/admin-integrado-usuario.md` |
| Contato do evento / plataforma | `schemas/evento.py` (contato_telefone/email), `models/platform_settings.py`, `routes/public.py` (`/contato`), `app/contato/` |
| Compressão de imagem | `lib/comprimir-imagem.ts` (navegador), `utils/imagem_processamento.py` (servidor, Pillow) |
| CAPTCHA | `services/turnstile.py`, `components/turnstile-widget.tsx` |
| Cifra em repouso (CPF/CNPJ, API keys) | `utils/secret_storage.py` (esquema `enc:v2`), `utils/cpf.py` |
| SEO | `app/sitemap.ts`, `app/robots.ts`, `lib/site-metadata.ts`, `app/eventos/[slug]/page.tsx` (JSON-LD) |
| Verificação deploy | `verificar-versao-site.sh`, `verify-production.sh` |
| Config / checks | `config/settings.py`, `production_checks.py`, `.env.production.example` |
| Go-live ops | `docs/11-go-live-asaas.md`, `atualizar-vps-agora.sh`, `configure-asaas-env.sh` |
| Testes | `test_compra_split_fluxo_mock.py`, `test-compra-split-mock.sh`, `test-asaas-webhook.sh`, `test-asaas-connection.py`, `validar-go-live-vps.sh` |
| CI | `.github/workflows/ci.yml` |
| Backup produção | `backup-prod-env.sh`, `verify-prod-backup.sh`, `restore-prod-env.sh` |

---

## 9. Extensões (não bloqueiam publicação)

Antecipação automática de cartão, cancelamento de saque, mock E2E (`ASAAS_E2E_MOCK`), scripts de setup de webhook, comprovante de transferência, backfill de ledger, modo `linked` legado (apenas dev).

---

## 10. Changelog da spec

| Versão | Data | Mudanças |
|---|---|---|
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
