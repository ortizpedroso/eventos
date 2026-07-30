"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CompraInfoConfianca } from "@/components/compra-info-confianca";
import { EventoGaleria } from "@/components/evento-galeria";
import { EventoHeroBanner } from "@/components/evento-hero-banner";
import { EventoMapaLocal } from "@/components/evento-mapa-local";
import { EventoMetaUnica } from "@/components/evento-meta-unica";
import { EventoPoliticaReembolso } from "@/components/evento-politica-reembolso";
import { EventoRelacionados } from "@/components/evento-relacionados";
import { ListaEsperaForm } from "@/components/lista-espera-form";
import { ListaInteresseForm } from "@/components/lista-interesse-form";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import { apiFetch, fetchSession, peekSessionCache } from "@/lib/api";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import { formatEventoDataHora } from "@/lib/eventos";
import { salvarRefPromoter } from "@/lib/promoter-ref";
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

  // Captura ?ref=CODIGO para atribuição no checkout (sem expor no share público).
  useEffect(() => {
    if (!evento?.id || typeof window === "undefined") return;
    const ref = searchParams.get("ref");
    if (ref?.trim()) salvarRefPromoter(evento.id, ref.trim());
  }, [evento?.id, searchParams]);

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
  }, [evento]);

  const descricaoLonga = useMemo(() => {
    if (!evento?.descricao) return false;
    return evento.descricao.trim().length > 320;
  }, [evento]);

  const [descricaoExpandida, setDescricaoExpandida] = useState(false);

  const imagemBanner = useMemo(
    () => resolveEventoImagemSrc(evento?.imagem_url),
    [evento?.imagem_url],
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
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-800 hover:underline">
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/eventos" className="hover:text-zinc-800 hover:underline">
          Eventos
        </Link>
        <span aria-hidden="true">/</span>
        <span className="max-w-[60vw] truncate text-zinc-700" aria-current="page">
          {evento.nome}
        </span>
      </nav>
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
            className="font-medium text-emerald-700 hover:underline"
          >
            Editar evento
          </Link>
        ) : null}
      </div>

      {alteracaoGuardada ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-left text-emerald-900"
          role="status"
        >
          Alteração salva com sucesso.
        </div>
      ) : null}

      {!evento.publicado ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-left text-amber-900">
          <strong>Evento pausado.</strong> Só você (organizador) vê esta página enquanto logado.
          Não aparece na listagem pública e não é possível comprar ingressos até republicar.
        </div>
      ) : null}

      {imagemBanner ? (
        <EventoHeroBanner
          nome={evento.nome}
          categoria={evento.categoria}
          imagemUrl={imagemBanner}
          local={evento.local}
          fmtInicio={fmtInicio}
          mostrarAcoes={evento.publicado}
        />
      ) : (
        <EventoMetaUnica
          nome={evento.nome}
          categoria={evento.categoria}
          fmtInicio={fmtInicio}
          local={evento.local}
          mostrarAcoes={evento.publicado}
        />
      )}

      {evento.publicado ? (
        <div className="grid w-full gap-6">
          {mostraListaInteresse ? <ListaInteresseForm slug={evento.slug} /> : null}
          {mostraListaEspera ? <ListaEsperaForm slug={evento.slug} /> : null}

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
              className="order-1 scroll-mt-24 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm lg:sticky lg:top-24 lg:order-2 lg:self-start"
              aria-label="Compra de ingresso"
            >
              <div className="mb-3 border-b border-zinc-200/80 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingressos</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-800">{precoFmt}</p>
                {loteAtivoNome ? (
                  <p className="mt-0.5 text-xs text-zinc-600">Lote à venda: {loteAtivoNome}</p>
                ) : null}
              </div>
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
              className="order-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:order-1 [&_p]:text-justify"
              aria-labelledby="sobre-evento-titulo"
            >
              <h2 id="sobre-evento-titulo" className="text-lg font-semibold text-zinc-900">
                Sobre o evento
              </h2>
              {evento.descricao?.trim() ? (
                <>
                  <p className="mt-4 whitespace-pre-line text-justify text-sm leading-6 text-zinc-800">
                    {descricaoExpandida ? evento.descricao : descricaoResumo}
                  </p>
                  {descricaoLonga ? (
                    <button
                      type="button"
                      onClick={() => setDescricaoExpandida((v) => !v)}
                      className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      {descricaoExpandida ? "Ler menos" : "Ler descrição completa"}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  O organizador ainda não adicionou uma descrição. Use a data e o local acima e
                  garanta seu ingresso na área de compra.
                </p>
              )}
              <EventoGaleria urls={evento.galeria_urls ?? []} className="mt-6 border-0 p-0 shadow-none" />
            </section>
          </div>
          <EventoMapaLocal local={evento.local} cidade={evento.cidade} />
          {(evento.organizador_nome || evento.contato_email || evento.contato_telefone) ? (
            <section
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              aria-labelledby="organizador-evento-titulo"
            >
              <h2 id="organizador-evento-titulo" className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Organizador
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {evento.organizador_nome ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Nome</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{evento.organizador_nome}</p>
                  </div>
                ) : null}
                {evento.contato_email ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">E-mail</p>
                    <p className="mt-1 text-sm">
                      <a href={`mailto:${evento.contato_email}`} className="font-medium text-emerald-700 hover:underline">
                        {evento.contato_email}
                      </a>
                    </p>
                  </div>
                ) : null}
                {evento.contato_telefone ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Telefone</p>
                    <p className="mt-1 text-sm">
                      <a
                        href={`https://wa.me/55${evento.contato_telefone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {evento.contato_telefone}
                      </a>
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          <CompraInfoConfianca />
          <EventoRelacionados slug={evento.slug} />
        </div>
      ) : (
        <section
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm [&_p]:text-justify"
          aria-labelledby="sobre-evento-titulo-pausado"
        >
          <h2 id="sobre-evento-titulo-pausado" className="text-lg font-semibold text-zinc-900">
            Sobre o evento
          </h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-800">
            {evento.descricao?.trim() || "Sem descrição."}
          </p>
        </section>
      )}

      {evento.publicado && compraDisponivel ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden">
          <button
            type="button"
            className="btn-success flex min-h-11 w-full items-center justify-center gap-2 text-white"
            onClick={() => {
              document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span>Comprar ingresso</span>
            <span className="font-semibold tabular-nums">{precoFmt}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
