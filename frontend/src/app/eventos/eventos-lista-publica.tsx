"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import { EventoCategoriasChips } from "@/components/evento-categorias-chips";
import { EventosGridSkeleton } from "@/components/eventos-grid-skeleton";
import { filtrarEventosVitrine } from "@/lib/eventos-vitrine";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import { EVENTO_CATEGORIAS, categoriaFromQuery } from "@/lib/evento-categorias";
import type { Evento } from "@/lib/types";

type Props = {
  initialEventos?: Evento[] | null;
  initialCategoria?: string;
  initialBusca?: string;
  initialCidade?: string;
};

type Ordenacao = "data_asc" | "data_desc" | "nome";

function buscaFromQuery(raw: string | null | undefined): string {
  return raw?.trim() ?? "";
}

export function EventosListaPublica({
  initialEventos = null,
  initialCategoria = "",
  initialBusca = "",
  initialCidade = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [eventos, setEventos] = useState<Evento[] | null>(initialEventos);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [busca, setBusca] = useState(initialBusca);
  const [buscaDebounced, setBuscaDebounced] = useState(initialBusca);
  const [categoria, setCategoria] = useState(initialCategoria);
  const [cidade, setCidade] = useState(initialCidade);
  const [cidadesOpcoes, setCidadesOpcoes] = useState<{ cidade: string; total: number }[]>([]);
  const [somenteVendasAbertas, setSomenteVendasAbertas] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("data_asc");

  // Refs com valores correntes para evitar closures desatualizadas no debounce
  const categoriaRef = useRef(categoria);
  categoriaRef.current = categoria;
  const cidadeRef = useRef(cidade);
  cidadeRef.current = cidade;
  const buscaDebouncedRef = useRef(buscaDebounced);
  buscaDebouncedRef.current = buscaDebounced;

  const buildUrl = useCallback(
    (overrides: { categoria?: string; cidade?: string; busca?: string }) => {
      const cat = overrides.categoria !== undefined ? overrides.categoria : categoriaRef.current;
      const cid = overrides.cidade !== undefined ? overrides.cidade : cidadeRef.current;
      const q = overrides.busca !== undefined ? overrides.busca : buscaDebouncedRef.current;
      const params = new URLSearchParams();
      if (cat) params.set("categoria", cat);
      if (q.trim()) params.set("q", q.trim());
      if (cid.trim()) params.set("cidade", cid.trim());
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname],
  );

  const atualizarCategoria = useCallback(
    (nova: string) => {
      setCategoria(nova);
      categoriaRef.current = nova;
      router.replace(buildUrl({ categoria: nova }), { scroll: false });
    },
    [buildUrl, router],
  );

  const atualizarCidade = useCallback(
    (nova: string) => {
      setCidade(nova);
      cidadeRef.current = nova;
      router.replace(buildUrl({ cidade: nova }), { scroll: false });
    },
    [buildUrl, router],
  );

  useEffect(() => {
    const daUrl = categoriaFromQuery(searchParams.get("categoria"));
    setCategoria((atual) => (atual === daUrl ? atual : daUrl));
    const qUrl = buscaFromQuery(searchParams.get("q"));
    setBusca((atual) => (atual === qUrl ? atual : qUrl));
    setBuscaDebounced((atual) => (atual === qUrl ? atual : qUrl));
    const cUrl = searchParams.get("cidade")?.trim() ?? "";
    setCidade((atual) => (atual === cUrl ? atual : cUrl));
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ cidade: string; total: number }[]>("/api/eventos/cidades");
        setCidadesOpcoes(data);
      } catch {
        setCidadesOpcoes([]);
      }
    })();
  }, []);

  // Debounce da busca: atualiza estado E URL após 400 ms de pausa
  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = busca.trim();
      setBuscaDebounced(trimmed);
      router.replace(buildUrl({ busca: trimmed }), { scroll: false });
    }, 400);
    return () => window.clearTimeout(id);
  }, [busca, buildUrl, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setFetchError(null);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (buscaDebounced) params.set("q", buscaDebounced);
        if (categoria) params.set("categoria", categoria);
        if (cidade.trim()) params.set("cidade", cidade.trim());
        const data = await apiFetch<Evento[]>(`/api/eventos?${params.toString()}`, {
          cache: "no-store",
        });
        if (!cancelled) setEventos(filtrarEventosVitrine(data));
      } catch {
        if (!cancelled) {
          setFetchError("Não foi possível carregar a lista agora. Tente novamente em instantes.");
          setEventos((prev) => (prev === null ? [] : prev));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryCount, buscaDebounced, categoria, cidade]);

  const eventosFiltrados = useMemo(() => {
    if (!eventos) return [];
    let lista = filtrarEventosVitrine([...eventos]);
    if (somenteVendasAbertas) {
      lista = lista.filter((e) => e.compra_disponivel !== false && Boolean(e.lote_compra_id));
    }
    lista.sort((a, b) => {
      if (ordenacao === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      const da = new Date(a.data_inicio).getTime();
      const db = new Date(b.data_inicio).getTime();
      return ordenacao === "data_desc" ? db - da : da - db;
    });
    return lista;
  }, [eventos, somenteVendasAbertas, ordenacao]);

  if (eventos === null) {
    return (
      <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
        <EventosGridSkeleton />
      </div>
    );
  }

  const temFiltro = Boolean(categoria || buscaDebounced || cidade.trim());

  return (
    <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
      <div className="mb-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <label htmlFor="busca-eventos" className="text-xs font-medium text-zinc-700">
            Buscar evento
          </label>
          <input
            id="busca-eventos"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, local ou palavra-chave…"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
          />
        </div>

        {cidadesOpcoes.length > 0 ? (
          <div>
            <label htmlFor="filtro-cidade" className="text-xs font-medium text-zinc-700">
              Cidade
            </label>
            <select
              id="filtro-cidade"
              value={cidade}
              onChange={(e) => atualizarCidade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm sm:max-w-xs"
            >
              <option value="">Todas as cidades</option>
              {cidadesOpcoes.map((c) => (
                <option key={c.cidade} value={c.cidade}>
                  {c.cidade} ({c.total})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium text-zinc-700">Categorias</p>
          <EventoCategoriasChips
            className="mt-2"
            categorias={EVENTO_CATEGORIAS}
            ativa={categoria}
            mostrarTodas
            layout="wrap"
            onSelecionar={atualizarCategoria}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={somenteVendasAbertas}
              onChange={(e) => setSomenteVendasAbertas(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Só eventos com vendas abertas
          </label>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="ordenar-eventos" className="text-zinc-600">
              Ordenar:
            </label>
            <select
              id="ordenar-eventos"
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="data_asc">Data (mais próximo)</option>
              <option value="data_desc">Data (mais distante)</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {temFiltro ? (
        <p className="mb-6 text-center text-sm text-zinc-600">
          {buscaDebounced ? (
            <>
              Resultados para <strong className="text-zinc-900">“{buscaDebounced}”</strong>
            </>
          ) : null}
          {buscaDebounced && categoria ? " · " : null}
          {categoria ? (
            <>
              categoria <strong className="text-zinc-900">{categoria}</strong>
            </>
          ) : null}
          {cidade.trim() ? (
            <>
              {(buscaDebounced || categoria) ? " · " : null}
              cidade <strong className="text-zinc-900">{cidade}</strong>
            </>
          ) : null}
          {" · "}
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setBuscaDebounced("");
              buscaDebouncedRef.current = "";
              setCategoria("");
              categoriaRef.current = "";
              setCidade("");
              cidadeRef.current = "";
              router.replace(pathname, { scroll: false });
            }}
            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        </p>
      ) : null}

      {fetchError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <p className="text-base font-medium text-red-800">{fetchError}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
          >
            ⟳ Tentar novamente
          </button>
        </div>
      ) : null}

      {!fetchError && eventos.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-600">
            {temFiltro ? (
              <>Nenhum evento encontrado com esses filtros.</>
            ) : (
              <>
                Ainda não há eventos publicados na vitrine — ou o seu está{" "}
                <strong className="font-semibold text-zinc-800">pausado</strong>.
              </>
            )}
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
            {temFiltro ? (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setBuscaDebounced("");
                  buscaDebouncedRef.current = "";
                  setCategoria("");
                  categoriaRef.current = "";
                  setCidade("");
                  cidadeRef.current = "";
                  router.replace(pathname, { scroll: false });
                }}
                className="btn-outline px-6 py-3 text-base shadow-sm"
              >
                Ver todos os eventos
              </button>
            ) : null}
            <Link href={authHrefParaCriarEvento()} className="btn-success px-6 py-3 text-base shadow-sm">
              Criar evento
            </Link>
          </div>
        </div>
      ) : null}

      {!fetchError && eventos.length > 0 && eventosFiltrados.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 shadow-sm">
          Nenhum evento corresponde aos filtros locais. Tente outra busca ou remova filtros.
        </p>
      ) : null}

      {!fetchError && eventosFiltrados.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {eventosFiltrados.map((e) => (
            <li key={e.id}>
              <EventoCardVitrine evento={e} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
