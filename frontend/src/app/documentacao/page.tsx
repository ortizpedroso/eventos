import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Documentação do sistema | EventosBR",
  description:
    "Arquitetura, API FastAPI, frontend Next.js, base de dados, pagamentos Asaas, lotes de ingressos e operação — EventosBR.",
};

const toc = [
  { id: "visao", label: "Visão geral" },
  { id: "arquitetura", label: "Arquitetura" },
  { id: "backend", label: "Backend e rotas" },
  { id: "dados", label: "Modelos de dados" },
  { id: "frontend", label: "Frontend" },
  { id: "pagamentos", label: "Pagamentos e lotes" },
  { id: "webhooks", label: "Webhooks" },
  { id: "operacao", label: "Configuração" },
  { id: "api-interativa", label: "API interativa" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-zinc-100 pb-10 pt-8 first:pt-0 last:border-0">
      <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}

export default function DocumentacaoPage() {
  return (
    <div className="min-h-screen bg-zinc-50/80">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Para equipas e integradores</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            Documentação do sistema
          </h1>
          <p className="mt-4 text-base text-zinc-600">
            Visão técnica do EventosBR: API em FastAPI, interface em Next.js, PostgreSQL (ou SQLite em
            desenvolvimento), Redis na infraestrutura Docker e pagamentos com Asaas. O repositório inclui também
            ficheiros Markdown em <code className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-xs">docs/</code> no
            código-fonte.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            <Link href="/" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              ← Voltar ao início
            </Link>
          </p>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-10">
          <nav
            className="mb-8 lg:col-span-3 lg:mb-0"
            aria-label="Índice da documentação"
          >
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Nesta página</p>
              <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-900 lg:border-0 lg:bg-transparent lg:px-2 lg:py-1 lg:shadow-none lg:hover:bg-emerald-50"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-9">
            <Section id="visao" title="Visão geral">
              <p>
                A <strong className="text-zinc-900">EventosBR</strong> permite a organizadores criarem eventos
                (página pública por <strong className="text-zinc-900">slug</strong>), definirem{" "}
                <strong className="text-zinc-900">lotes de ingressos</strong> (preço, ordem, capacidade, datas de
                venda) e a participantes comprarem com <strong className="text-zinc-900">PIX ou cartão</strong> via Asaas.
                Há fluxo de cancelamento com reembolso e relatórios para o organizador.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-zinc-900">API</strong>: Python, FastAPI, Pydantic, SQLAlchemy, Alembic.
                </li>
                <li>
                  <strong className="text-zinc-900">Web</strong>: Next.js (App Router), TypeScript, Tailwind.
                </li>
                <li>
                  <strong className="text-zinc-900">Auth</strong>: JWT no header <code>Authorization: Bearer</code>.
                </li>
              </ul>
            </Section>

            <Section id="arquitetura" title="Arquitetura e comunicação">
              <p>
                O browser carrega o site Next (porta típica <strong>3000</strong>). Os pedidos à API podem seguir
                dois caminhos:
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <strong className="text-zinc-900">Proxy same-origin</strong>: sem{" "}
                  <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_API_URL</code> no cliente, o{" "}
                  <code className="rounded bg-zinc-100 px-1">fetch</code> usa a origem do Next; o ficheiro{" "}
                  <code className="rounded bg-zinc-100 px-1">next.config.ts</code> reescreve{" "}
                  <code className="rounded bg-zinc-100 px-1">/api/*</code> para o backend (
                  <code className="rounded bg-zinc-100 px-1">API_PROXY_TARGET</code> /{" "}
                  <code className="rounded bg-zinc-100 px-1">INTERNAL_API_URL</code> / 127.0.0.1:8000).
                </li>
                <li>
                  <strong className="text-zinc-900">URL direta da API</strong>: com{" "}
                  <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_API_URL</code>, o browser fala com a API em
                  outro host; é necessário <code className="rounded bg-zinc-100 px-1">CORS_ORIGINS</code> correto no
                  FastAPI.
                </li>
              </ol>
              <p>
                Em <strong className="text-zinc-900">Docker</strong>, o serviço <code className="rounded bg-zinc-100 px-1">web</code> usa{" "}
                <code className="rounded bg-zinc-100 px-1">INTERNAL_API_URL=http://api:8000</code> para renderização no
                servidor; o utilizador continua a precisar de uma URL pública da API no browser quando aplicável.
              </p>
            </Section>

            <Section id="backend" title="Backend (FastAPI)">
              <p>
                Entrada: <code className="rounded bg-zinc-100 px-1">app/main.py</code>. Carrega{" "}
                <code className="rounded bg-zinc-100 px-1">.env</code>, aplica CORS, monta routers sob{" "}
                <code className="rounded bg-zinc-100 px-1">/api/...</code>, expõe <code className="rounded bg-zinc-100 px-1">GET /health</code>{" "}
                (liveness) e <code className="rounded bg-zinc-100 px-1">GET /ready</code> (readiness com{" "}
                <code className="rounded bg-zinc-100 px-1">SELECT 1</code> na BD; <strong>503</strong> se indisponível).
              </p>
              <p className="font-medium text-zinc-900">Routers principais</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/auth</code> — registo, login,{" "}
                  <code className="rounded bg-zinc-100 px-1">/me</code> (GET/PATCH); organizadores configuram{" "}
                  <code className="rounded bg-zinc-100 px-1">asaas_wallet_id</code> para receber repasses via split.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/eventos</code> — criar (organizador), atualizar por{" "}
                  <code className="rounded bg-zinc-100 px-1">id</code>, listar meus, obter por <code className="rounded bg-zinc-100 px-1">slug</code>, listagem pública paginada.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/pagamentos</code> —{" "}
                  <code className="rounded bg-zinc-100 px-1">POST /criar</code>,{" "}
                  <code className="rounded bg-zinc-100 px-1">GET /meus</code>,{" "}
                  <code className="rounded bg-zinc-100 px-1">POST /cancelar</code>.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/ingressos</code> — listagem simplificada dos ingressos do utilizador.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/relatorios</code> — agregados do organizador; exportação de participantes em JSON ou CSV (
                  <code className="rounded bg-zinc-100 px-1">/organizador/participantes?formato=csv</code>).
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/api/webhooks</code> — Asaas (<code className="rounded bg-zinc-100 px-1">POST /asaas</code>) e mock de pagamento só em desenvolvimento.
                </li>
              </ul>
              <p>
                Configuração: <code className="rounded bg-zinc-100 px-1">config/settings.py</code> (Pydantic Settings).
                Sessão SQLAlchemy: <code className="rounded bg-zinc-100 px-1">config/database.py</code> com dependência{" "}
                <code className="rounded bg-zinc-100 px-1">get_db()</code>.
              </p>
            </Section>

            <Section id="dados" title="Modelos de dados">
              <p>
                Entidades principais: <strong className="text-zinc-900">Usuario</strong>,{" "}
                <strong className="text-zinc-900">Evento</strong>, <strong className="text-zinc-900">EventoIngressoLote</strong>,{" "}
                <strong className="text-zinc-900">Ingresso</strong>, <strong className="text-zinc-900">Cancelamento</strong>,{" "}
                <strong className="text-zinc-900">WebhookEvent</strong> (idempotência de webhooks). Chaves primárias em UUID string.
              </p>
              <p>
                O evento tem <code className="rounded bg-zinc-100 px-1">publicado</code> (vitrine e compra),{" "}
                <code className="rounded bg-zinc-100 px-1">slug</code> único (não muda no PATCH),{" "}
                <code className="rounded bg-zinc-100 px-1">preco_ingresso</code> sincronizado com o{" "}
                <strong className="text-zinc-900">menor preço entre lotes activos</strong>. Cada ingresso pode referenciar{" "}
                <code className="rounded bg-zinc-100 px-1">lote_id</code> e guarda o valor pago em{" "}
                <code className="rounded bg-zinc-100 px-1">valor</code>.
              </p>
              <p>
                Migrações: pasta <code className="rounded bg-zinc-100 px-1">alembic/versions/</code>; em Docker a API
                executa <code className="rounded bg-zinc-100 px-1">alembic upgrade head</code> ao arrancar.
              </p>
            </Section>

            <Section id="frontend" title="Frontend (Next.js)">
              <p>
                Código em <code className="rounded bg-zinc-100 px-1">frontend/src</code>. O cliente HTTP{" "}
                <code className="rounded bg-zinc-100 px-1">apiFetch</code> em{" "}
                <code className="rounded bg-zinc-100 px-1">lib/api.ts</code> anexa o token{" "}
                <code className="rounded bg-zinc-100 px-1">eventosbr_token</code>, trata 401 e formata erros de validação
                422.
              </p>
              <p className="font-medium text-zinc-900">Rotas de interface relevantes</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code className="rounded bg-zinc-100 px-1">/eventos</code> — lista pública;{" "}
                  <code className="rounded bg-zinc-100 px-1">/eventos/[slug]</code> — detalhe, lotes, compra;{" "}
                  <code className="rounded bg-zinc-100 px-1">/eventos/novo</code> e{" "}
                  <code className="rounded bg-zinc-100 px-1">/eventos/[slug]/editar</code> — editor de lotes.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">/auth</code>, <code className="rounded bg-zinc-100 px-1">/conta/*</code>,{" "}
                  <code className="rounded bg-zinc-100 px-1">/organizador/*</code> — áreas autenticadas.
                </li>
              </ul>
              <p>
                Ao <strong className="text-zinc-900">publicar na vitrine</strong> a partir de &quot;Meus eventos&quot;, o PATCH envia também{" "}
                <code className="rounded bg-zinc-100 px-1">ingresso_lotes</code> para não apagar lotes por omissão.
              </p>
            </Section>

            <Section id="pagamentos" title="Pagamentos e lotes">
              <p>
                <code className="rounded bg-zinc-100 px-1">POST /api/pagamentos/criar</code> resolve o{" "}
                <strong className="text-zinc-900">lote atual</strong> por ordem, atividade, datas e capacidade; o
                campo <code className="rounded bg-zinc-100 px-1">valor_centavos</code> tem de coincidir exatamente com
                o preço desse lote. Cria-se um registo <code className="rounded bg-zinc-100 px-1">Ingresso</code> em{" "}
                <code className="rounded bg-zinc-100 px-1">pendente</code> com reserva de 35 minutos. O front chama{" "}
                <code className="rounded bg-zinc-100 px-1">POST /api/pagamentos/asaas/cobranca</code> (PIX, cartão ou fatura).
                Requer <code className="rounded bg-zinc-100 px-1">asaas_wallet_id</code> do organizador e split da plataforma.
              </p>
              <p>
                Com <code className="rounded bg-zinc-100 px-1">ASAAS_DISABLED</code> na API, o fluxo pode concluir a
                compra sem cobrança real (apenas para desenvolvimento controlado).
              </p>
              <p>
                Cancelamento: <code className="rounded bg-zinc-100 px-1">POST /api/pagamentos/cancelar</code> com
                ingresso pago dentro do prazo; reembolso via API Asaas.
              </p>
            </Section>

            <Section id="webhooks" title="Webhooks Asaas">
              <p>
                <code className="rounded bg-zinc-100 px-1">POST /api/webhooks/asaas</code> valida o header{" "}
                <code className="rounded bg-zinc-100 px-1">asaas-access-token</code>. Eventos
                duplicados são ignorados graças à tabela <code className="rounded bg-zinc-100 px-1">webhook_events</code>.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code className="rounded bg-zinc-100 px-1">PAYMENT_RECEIVED</code> /{" "}
                  <code className="rounded bg-zinc-100 px-1">PAYMENT_CONFIRMED</code> — marca o ingresso como{" "}
                  <code className="rounded bg-zinc-100 px-1">pago</code>.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">PAYMENT_REFUNDED</code> — cancela após reembolso.
                </li>
                <li>
                  <code className="rounded bg-zinc-100 px-1">PAYMENT_OVERDUE</code> /{" "}
                  <code className="rounded bg-zinc-100 px-1">PAYMENT_DELETED</code> — libera reserva pendente.
                </li>
              </ul>
            </Section>

            <Section id="operacao" title="Configuração e operação">
              <p>
                Variáveis principais na raiz: <code className="rounded bg-zinc-100 px-1">DATABASE_URL</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">SECRET_KEY</code> (obrigatória fora de development), chaves
                Asaas (<code className="rounded bg-zinc-100 px-1">ASAAS_*</code>), <code className="rounded bg-zinc-100 px-1">CORS_ORIGINS</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">ENVIRONMENT</code>, <code className="rounded bg-zinc-100 px-1">DEBUG</code>.
              </p>
              <p>
                <strong className="text-zinc-900">Docker Compose</strong> na raiz: serviços <code className="rounded bg-zinc-100 px-1">api</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">db</code> (Postgres), <code className="rounded bg-zinc-100 px-1">redis</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">web</code> (Next). Ver <code className="rounded bg-zinc-100 px-1">README.md</code> e{" "}
                <code className="rounded bg-zinc-100 px-1">.env.example</code>.
              </p>
              <p>
                Testes automatizados: <code className="rounded bg-zinc-100 px-1">pytest tests/</code> (SQLite em memória,
                <code className="rounded bg-zinc-100 px-1"> ASAAS_DISABLED=true</code> por defeito).
              </p>
            </Section>

            <Section id="api-interativa" title="API interativa (OpenAPI)">
              <p>
                Com a API em execução (por exemplo <code className="rounded bg-zinc-100 px-1">http://localhost:8000</code>):
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-zinc-900">Swagger UI</strong>:{" "}
                  <a
                    href="http://localhost:8000/docs"
                    className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    /docs
                  </a>
                </li>
                <li>
                  <strong className="text-zinc-900">ReDoc</strong>:{" "}
                  <a
                    href="http://localhost:8000/redoc"
                    className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    /redoc
                  </a>
                </li>
              </ul>
              <p className="text-zinc-600">
                Os links acima assumem a API local na porta 8000; ajuste o host se usar outro ambiente.
              </p>
            </Section>
          </article>
        </div>
      </div>
    </div>
  );
}
