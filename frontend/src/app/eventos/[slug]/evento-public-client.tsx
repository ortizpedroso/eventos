"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CompraInfoConfianca } from "@/components/compra-info-confianca";
import { EventoCategoriaBadge } from "@/components/evento-categoria-badge";
import { EventoHeroBanner } from "@/components/evento-hero-banner";
import { EventoMapaLocal } from "@/components/evento-mapa-local";
import { EventoPoliticaReembolso } from "@/components/evento-politica-reembolso";
import { EventoRelacionados } from "@/components/evento-relacionados";
import { EventoResumoRapido } from "@/components/evento-resumo-rapido";
import { ListaEsperaForm } from "@/components/lista-espera-form";
import { ListaInteresseForm } from "@/components/lista-interesse-form";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import { apiFetch, fetchSession, peekSessionCache } from "@/lib/api";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { formatEventoDataHora } from "@/lib/eventos";
import type { Evento, Usuario } from "@/lib/types";

const ComprarIngressoLazy = dynamic(
  () =>
    import("@/components/comprar-ingresso").then((m) => ({
      default: m.ComprarIngresso,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[360px] rounded-lg border border-zinc-200 bg-zinc-100/80"
        aria-label="Carregando área de pagamento"
      />
    ),
  },
);

type Props = {
  slug: string;
  initialEvento?: Evento | null;
  alteracaoGuardada?: boolean;
  ingressoRetomarId?: string | null;
};

export function EventoPublicClient({
  slug,
  initialEvento = null,
  alteracaoGuardada = false,
  ingressoRetomarId = null,
}: Props) {
  const searchParams = useSearchParams();
  const [evento, setEvento] = useState<Evento | null>(initialEvento);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialEvento);
  const [me, setMe] = useState<Usuario | null>(() => peekSessionCache() ?? null);
  const [tokenEsperaValido, setTokenEsperaValido] = useState<boolean | null>(null);
  const tokenEsperaQuery = searchParams.get("espera");

  useEffect(() => {
    if (!alteracaoGuardada || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("atualizado") === "1") {
      url.searchParams.delete("atualizado");
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState(null, "", next || url.pathname);
    }
  }, [alteracaoGuardada]);

  useEffect(() => {
    if (!ingressoRetomarId || typeof window === "undefined") return;
    const el = document.getElementById("comprar");
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [ingressoRetomarId, loading, evento]);

  useEffect(() => {
    if (searchParams.get("compra") !== "ok" || typeof window === "undefined") return;
    const el = document.getElementById("comprar");
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [searchParams, loading, evento]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const u = await fetchSession();
      if (!cancelled) setMe(u);
    })();

    if (initialEvento) {
      setEvento(initialEvento);
      setErr(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const ev = await apiFetch<Evento>(`/api/eventos/${slug}`, { cache: "no-store" });
        if (!cancelled) {
          setEvento(ev);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Evento não encontrado");
          setEvento(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, initialEvento]);

  useEffect(() => {
    if (!tokenEsperaQuery || !slug) {
      setTokenEsperaValido(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await apiFetch<{ ok: boolean }>(
          `/api/listas/espera/validar/${encodeURIComponent(slug)}?token=${encodeURIComponent(tokenEsperaQuery)}`,
        );
        if (!cancelled) setTokenEsperaValido(true);
      } catch {
        if (!cancelled) setTokenEsperaValido(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, tokenEsperaQuery]);

  useEffect(() => {
    const onSync = () => {
      void (async () => {
        const u = await fetchSession();
        setMe(u);
      })();
    };
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, onSync);
  }, []);

  const precoFmt = useMemo(() => {
    if (!evento) return "";
    const v = Number(evento.preco_compra ?? evento.preco_ingresso);
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, [evento]);

  const loteAtivoNome = useMemo(() => {
    if (!evento?.ingresso_lotes?.length || !evento.lote_compra_id) return null;
    return evento.ingresso_lotes.find((l) => l.id === evento.lote_compra_id)?.nome ?? null;
  }, [evento]);

  const descricaoResumo = useMemo(() => {
    if (!evento?.descricao) return "";
    const t = evento.descricao.trim();
    if (t.length <= 320) return t;
    return `${t.slice(0, 320).trim()}…`;
  }, [evento?.descricao]);

  const descricaoLonga = useMemo(() => {
    if (!evento?.descricao) return false;
    return evento.descricao.trim().length > 320;
  }, [evento?.descricao]);

  const imagemBanner = useMemo(
    () => resolveEventoImagemSrc(evento?.imagem_url),
    [evento?.imagem_url],
  );

  const souOrganizador = Boolean(
    me && evento && me.tipo === "organizador" && me.id === evento.organizador_id,
  );

  if (loading && !evento) {
    return (
      <div className="space-y-6 py-2" aria-busy aria-label="Carregando evento">
        <div className="text-sm text-zinc-600">
          <Link className="hover:underline" href="/eventos">
            ← Voltar aos eventos
          </Link>
        </div>
        <div className="h-56 rounded-xl bg-zinc-100 sm:h-64" aria-hidden />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-h-[280px] rounded-xl border border-zinc-200 bg-zinc-50" aria-hidden />
          <div className="min-h-[360px] rounded-xl border border-zinc-200 bg-zinc-50" aria-hidden />
        </div>
      </div>
    );
  }

  if (err || !evento) {
    return (
      <div className="space-y-4">
        <Link className="text-sm text-zinc-600 hover:underline" href="/eventos">
          ← Voltar aos eventos
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err ?? "Evento não encontrado."}
        </div>
      </div>
    );
  }

  const fmtInicio = formatEventoDataHora(evento.data_inicio);
  const compraDisponivel = evento.compra_disponivel ?? Boolean(evento.lote_compra_id);
  const motivoCompraIndisponivel = evento.motivo_compra_indisponivel ?? null;
  const codigoCompraIndisponivel = evento.compra_indisponivel_codigo ?? null;
  const mostraListaInteresse =
    !compraDisponivel && evento.aceita_interesse && codigoCompraIndisponivel === "pre_venda";
  const mostraListaEspera =
    !compraDisponivel && evento.lista_espera_habilitada && codigoCompraIndisponivel === "esgotado";
  const janelaEsperaExclusiva = Boolean(evento.espera_janela_exclusiva_ativa);
  const podeComprarComEspera =
    compraDisponivel &&
    (!janelaEsperaExclusiva || tokenEsperaValido === true);
  const bloqueadoPorEspera =
    compraDisponivel && janelaEsperaExclusiva && tokenEsperaValido !== true;

  return (
    <div className={`space-y-6${evento.publicado ? " pb-24 lg:pb-0" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <Link className="hover:underline" href="/eventos">
          ← Voltar aos eventos
        </Link>
        {me &&
        evento &&
        me.tipo === "organizador" &&
        me.id === evento.organizador_id ? (
          <Link
            href={`/eventos/${slug}/editar`}
            className="font-medium text-emerald-800 hover:underline"
          >
            Editar evento
          </Link>
        ) : null}
      </div>

      {alteracaoGuardada ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-justify text-emerald-900"
          role="status"
        >
          Alteração salva com sucesso.
        </div>
      ) : null}

      {!evento.publicado ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-justify text-amber-900">
          <strong>Evento pausado.</strong> Só você (organizador) vê esta página enquanto logado.
          Não aparece na listagem pública e não é possível comprar ingressos até republicar.
        </div>
      ) : null}

      {imagemBanner ? (
        <div className="-mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]">
          <EventoHeroBanner
            nome={evento.nome}
            categoria={evento.categoria}
            imagemUrl={imagemBanner}
            local={evento.local}
            fmtInicio={fmtInicio}
            precoFmt={precoFmt}
          />
        </div>
      ) : null}

      {evento.publicado ? (
        <div className="grid w-full gap-6">
          <EventoResumoRapido
            fmtInicio={fmtInicio}
            local={evento.local}
            precoFmt={precoFmt}
            precoIngresso={
              evento.preco_compra != null
                ? Number(evento.preco_compra)
                : Number(evento.preco_ingresso)
            }
            loteAtivoNome={loteAtivoNome}
            lotes={evento.ingresso_lotes}
            loteCompraId={evento.lote_compra_id}
            compraDisponivel={compraDisponivel}
            motivoCompraIndisponivel={motivoCompraIndisponivel}
          />

          {evento.urgencia_ativo && evento.urgencia_badge ? (
            <p
              className="inline-flex w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-950"
              role="status"
            >
              {evento.urgencia_badge}
            </p>
          ) : null}

          {mostraListaInteresse ? (
            <ListaInteresseForm slug={evento.slug} />
          ) : null}

          {mostraListaEspera ? (
            <ListaEsperaForm slug={evento.slug} />
          ) : null}

          {bloqueadoPorEspera ? (
            <div
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
              role="status"
            >
              <p className="font-semibold">Vaga reservada para a lista de espera</p>
              <p className="mt-1 leading-relaxed">
                {tokenEsperaQuery && tokenEsperaValido === false
                  ? "Este link expirou ou não é válido. Aguarde um novo e-mail ou entre na fila novamente."
                  : "Quem está na fila recebe um link exclusivo por e-mail quando uma vaga abre."}
              </p>
            </div>
          ) : null}

          {!compraDisponivel ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <p className="font-semibold">Vendas encerradas ou indisponíveis</p>
              <p className="mt-1 leading-relaxed">
                {motivoCompraIndisponivel ??
                  "Não há ingressos à venda no momento. Contacte o organizador do evento."}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
            <aside
              id="comprar"
              className="order-1 scroll-mt-24 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm lg:order-2 lg:self-start"
              aria-label="Compra de ingresso"
            >
              <EventoPoliticaReembolso />
              <div className="mt-4">
                <ComprarIngressoLazy
                  embedded
                  eventoId={evento.id}
                  eventoSlug={evento.slug}
                  eventoNome={evento.nome}
                  precoIngresso={Number(evento.preco_compra ?? evento.preco_ingresso)}
                  limiteIngressosPorCpf={evento.limite_ingressos_por_cpf ?? null}
                  compraDisponivel={podeComprarComEspera}
                  motivoCompraIndisponivel={
                    bloqueadoPorEspera
                      ? "Use o link enviado por e-mail da lista de espera para comprar nesta janela."
                      : motivoCompraIndisponivel
                  }
                  compraIndisponivelCodigo={codigoCompraIndisponivel}
                  usuarioInicial={me}
                  sessaoInicialResolvida
                  ingressoRetomarId={ingressoRetomarId}
                  loteAtivoNome={loteAtivoNome}
                  ingressoLotes={evento.ingresso_lotes}
                  loteCompraId={evento.lote_compra_id}
                  eventoDataInicio={evento.data_inicio}
                  eventoDataFim={evento.data_fim}
                  eventoLocal={evento.local}
                  mensagemConfirmacao={evento.mensagem_confirmacao}
                  parcelamentoHabilitado={evento.parcelamento_habilitado}
                  parcelamentoMax={evento.parcelamento_max}
                  repasseParcelamento={evento.repasse_parcelamento ?? "comprador"}
                  urgenciaAtivo={evento.urgencia_ativo}
                  urgenciaBadge={evento.urgencia_badge}
                  tokenEspera={tokenEsperaValido ? tokenEsperaQuery : null}
                />
              </div>
            </aside>

            <section
              className="order-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:order-1 [&_dd]:text-justify [&_p]:text-justify"
              aria-labelledby="sobre-evento-titulo"
            >
              <h2 id="sobre-evento-titulo" className="text-lg font-semibold text-zinc-900">
                Sobre o evento
              </h2>
              {!imagemBanner ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">{evento.nome}</h1>
                  <EventoCategoriaBadge categoria={evento.categoria} variant="inline" />
                </div>
              ) : (
                <p className="mt-3 text-base font-semibold text-zinc-900">{evento.nome}</p>
              )}
              <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
                <div>
                  <dt className="font-medium text-zinc-800">Início</dt>
                  <dd>{fmtInicio}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-800">Local</dt>
                  <dd className="break-words">{evento.local}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-800">Ingresso</dt>
                  <dd className="font-semibold text-emerald-800">{precoFmt}</dd>
                </div>
              </dl>
              {evento.ingresso_lotes && evento.ingresso_lotes.length > 0 ? (
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lotes</p>
                  <ul className="mt-2 space-y-2 text-xs text-zinc-600">
                    {evento.ingresso_lotes
                      .slice()
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((l) => {
                        const max = l.quantidade_maxima;
                        const cap =
                          max != null ? `${l.vendidos}/${max}` : `${l.vendidos} vendidos`;
                        const atual = evento.lote_compra_id === l.id;
                        return (
                          <li
                            key={l.id}
                            className={`flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-2 py-1.5 ${
                              atual ? "border-emerald-300 bg-emerald-50/80" : "border-zinc-100 bg-zinc-50/80"
                            }`}
                          >
                            <span className="font-medium text-zinc-800">{l.nome}</span>
                            <span className="tabular-nums text-zinc-700">
                              {l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {cap}
                              {atual ? (
                                <span className="ml-1 text-emerald-800"> (à venda)</span>
                              ) : !l.ativo ? (
                                <span className="ml-1 text-zinc-500"> (inativo)</span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : null}
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-800">
                {descricaoResumo}
              </p>
              {descricaoLonga ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-emerald-800 hover:underline">
                    Ler descrição completa
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-justify text-sm leading-6 text-zinc-800">
                    {evento.descricao}
                  </p>
                </details>
              ) : null}
            </section>
          </div>
          <EventoMapaLocal local={evento.local} cidade={evento.cidade} />
          <CompraInfoConfianca />
          <EventoRelacionados slug={evento.slug} />
        </div>
      ) : (
        <section
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm [&_dd]:text-justify [&_p]:text-justify"
          aria-labelledby="sobre-evento-titulo-pausado"
        >
          <h2 id="sobre-evento-titulo-pausado" className="text-lg font-semibold text-zinc-900">
            Sobre o evento
          </h2>
          {!imagemBanner ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">{evento.nome}</h1>
              <EventoCategoriaBadge categoria={evento.categoria} variant="inline" />
            </div>
          ) : (
            <p className="mt-3 text-base font-semibold text-zinc-900">{evento.nome}</p>
          )}
          <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
            <div>
              <dt className="font-medium text-zinc-800">Início</dt>
              <dd>{fmtInicio}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-800">Local</dt>
              <dd className="break-words">{evento.local}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-800">Ingresso</dt>
              <dd className="font-semibold text-emerald-800">{precoFmt}</dd>
            </div>
          </dl>
          {evento.ingresso_lotes && evento.ingresso_lotes.length > 0 ? (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lotes</p>
              <ul className="mt-2 space-y-2 text-xs text-zinc-600">
                {evento.ingresso_lotes
                  .slice()
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((l) => {
                    const max = l.quantidade_maxima;
                    const cap = max != null ? `${l.vendidos}/${max}` : `${l.vendidos} vendidos`;
                    const atual = evento.lote_compra_id === l.id;
                    return (
                      <li
                        key={l.id}
                        className={`flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-2 py-1.5 ${
                          atual ? "border-emerald-300 bg-emerald-50/80" : "border-zinc-100 bg-zinc-50/80"
                        }`}
                      >
                        <span className="font-medium text-zinc-800">{l.nome}</span>
                        <span className="tabular-nums text-zinc-700">
                          {l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {cap}
                          {atual ? (
                            <span className="ml-1 text-emerald-800"> (à venda)</span>
                          ) : !l.ativo ? (
                            <span className="ml-1 text-zinc-500"> (inativo)</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
          <p className="mt-5 whitespace-pre-line border-t border-zinc-100 pt-5 text-justify text-sm leading-6 text-zinc-800">
            {evento.descricao}
          </p>
        </section>
      )}

      {evento.publicado && compraDisponivel ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] lg:hidden">
          <button
            type="button"
            className="btn-success flex w-full items-center justify-center gap-2 text-white"
            onClick={() => {
              document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span>Comprar ingresso</span>
            <span className="font-semibold">{precoFmt}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
