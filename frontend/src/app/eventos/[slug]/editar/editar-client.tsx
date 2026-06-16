"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EVENTO_CATEGORIAS, isoToDatetimeLocalValue, slugFromNome } from "@/lib/eventos";
import { EventoCuponsEditor } from "@/components/evento-cupons-editor";
import {
  EventoLotesEditor,
  eventoLotesToRows,
  lotesRowsToApiPayload,
  precoMinimoDosLotes,
  type LoteFormRow,
} from "@/components/evento-lotes-editor";
import { EventoImagemField } from "@/components/evento-imagem-field";
import { EventoVisibilidadeAvisosLegais } from "@/components/evento-visibilidade-avisos";
import { apiFetch } from "@/lib/api";
import type { Evento, Usuario } from "@/lib/types";

type Props = { slug: string };

type SalvarPayload = {
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  cidade?: string | null;
  imagem_url?: string | null;
  preco_ingresso: number;
  ingresso_lotes: ReturnType<typeof lotesRowsToApiPayload>;
  categoria: string;
  mensagem_confirmacao?: string | null;
  publicado: boolean;
  limite_ingressos_por_cpf?: number | null;
};

export function EditarEventoClient({ slug }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<Usuario | null>(null);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nomeParaSlug, setNomeParaSlug] = useState("");
  const [origin, setOrigin] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [loteRows, setLoteRows] = useState<LoteFormRow[]>([]);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (!cancelled) setMe(u);
      } catch {
        if (!cancelled) setMe(null);
      }
      try {
        const ev = await apiFetch<Evento>(`/api/eventos/${slug}`, { cache: "no-store" });
        if (!cancelled) {
          setEvento(ev);
          setNomeParaSlug(ev.nome);
          setImagemUrl(ev.imagem_url ?? "");
          setLoteRows(eventoLotesToRows(ev));
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "Evento não encontrado");
          setEvento(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function onSubmit(formData: FormData) {
    if (!evento) return;
    setSaving(true);
    setError(null);

    const preco_ingresso = precoMinimoDosLotes(loteRows);
    const lotesPayload = lotesRowsToApiPayload(loteRows);
    for (const l of lotesPayload) {
      if (l.tipo === "cortesia") continue;
      if (!Number.isFinite(l.preco) || l.preco < 0.5) {
        setError("Cada lote pago precisa de preço válido (mínimo R$ 0,50).");
        setSaving(false);
        return;
      }
    }
    const temPago = lotesPayload.some((l) => l.tipo !== "cortesia");
    if (temPago && (!Number.isFinite(preco_ingresso) || preco_ingresso < 0.5)) {
      setError("Informe pelo menos um lote pago com preço mínimo de R$ 0,50.");
      setSaving(false);
      return;
    }

    const rawIni = String(formData.get("data_inicio") ?? "").trim();
    const di = new Date(rawIni);
    if (!Number.isFinite(di.getTime())) {
      setError("Data de início inválida.");
      setSaving(false);
      return;
    }

    const msg = String(formData.get("mensagem_confirmacao") ?? "").trim();
    const publicado = String(formData.get("publicado") ?? "true") !== "false";
    const limiteRaw = String(formData.get("limite_ingressos_por_cpf") ?? "").trim();
    const limite_ingressos_por_cpf = limiteRaw ? Number.parseInt(limiteRaw, 10) : null;

    const payload: SalvarPayload = {
      nome: String(formData.get("nome") ?? ""),
      descricao: String(formData.get("descricao") ?? ""),
      data_inicio: rawIni,
      data_fim: rawIni,
      local: String(formData.get("local") ?? ""),
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      imagem_url: imagemUrl.trim() || null,
      preco_ingresso,
      ingresso_lotes: lotesPayload,
      categoria: String(formData.get("categoria") ?? "Outros"),
      mensagem_confirmacao: msg || null,
      publicado,
      limite_ingressos_por_cpf:
        limite_ingressos_por_cpf && limite_ingressos_por_cpf >= 1 ? limite_ingressos_por_cpf : null,
    };

    try {
      await apiFetch<Evento>(`/api/eventos/id/${evento.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push(`/eventos/${slug}?atualizado=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-2xl py-8">
        <div className="animate-pulse space-y-4" role="status" aria-label="Carregando evento">
          <div className="h-4 w-48 rounded bg-zinc-200" />
          <div className="h-8 w-2/3 rounded bg-zinc-200" />
          <div className="h-40 rounded-xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (me === null) {
    return (
      <div className="mx-auto mt-10 max-w-2xl space-y-4">
        <Link href="/auth" className="text-sm text-emerald-800 underline">
          Inicie sessão
        </Link>
        <p className="text-sm text-zinc-700">É necessário estar autenticado para editar um evento.</p>
      </div>
    );
  }

  if (loadErr || !evento) {
    return (
      <div className="mx-auto mt-10 max-w-2xl space-y-4">
        <Link href="/" className="text-sm text-zinc-600 hover:underline">
          ← Início
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {loadErr ?? "Evento não encontrado."}
        </div>
      </div>
    );
  }

  if (me.tipo !== "organizador" || me.id !== evento.organizador_id) {
    return (
      <div className="mx-auto mt-10 max-w-2xl space-y-4">
        <Link href={`/eventos/${slug}`} className="text-sm text-zinc-600 hover:underline">
          ← Voltar ao evento
        </Link>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Só o organizador deste evento pode editá-lo.
        </div>
      </div>
    );
  }

  const slugPrev = slugFromNome(nomeParaSlug);

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl">
      <nav className="mb-4 text-sm text-zinc-600" aria-label="Navegação">
        <Link href="/organizador/eventos" className="hover:text-emerald-800 hover:underline">
          Painel
        </Link>
        <span className="mx-1.5 text-zinc-400">/</span>
        <Link href="/organizador/eventos" className="hover:text-emerald-800 hover:underline">
          Meus eventos
        </Link>
        <span className="mx-1.5 text-zinc-400">/</span>
        <span className="text-zinc-900">Editar</span>
      </nav>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Editar evento</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
            Altere texto, datas, preço ou visibilidade quando quiser. O link público continua o mesmo —{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">/eventos/{evento.slug}</code> — para
            quem já guardou o endereço não mudar nada.
          </p>
        </div>
        <Link
          href={`/eventos/${slug}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
        >
          Cancelar
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <form action={onSubmit} className="space-y-6">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="nome">
              Nome
            </label>
            <input
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="nome"
              name="nome"
              required
              defaultValue={evento.nome}
              onChange={(e) => setNomeParaSlug(e.target.value)}
            />
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <span className="font-medium">URL (não muda): </span>
            <span className="break-all font-mono">
              {origin || "…"}
              /eventos/{evento.slug}
            </span>
            <p className="mt-1 text-zinc-600">
              Pré-visualização do slug só pelo nome (referência):{" "}
              <span className="font-mono">{slugPrev}</span> — o link real continua{" "}
              <span className="font-mono">{evento.slug}</span>.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="descricao">
              Descrição
            </label>
            <textarea
              className="min-h-[112px] rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="descricao"
              name="descricao"
              required
              defaultValue={evento.descricao}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="categoria">
              Categoria
            </label>
            <select
              id="categoria"
              name="categoria"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              defaultValue={evento.categoria}
            >
              {EVENTO_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2 sm:max-w-md">
              <label className="text-sm font-medium text-zinc-800" htmlFor="data_inicio">
                Data e hora de início
              </label>
              <input
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                id="data_inicio"
                name="data_inicio"
                type="datetime-local"
                step={60}
                required
                defaultValue={isoToDatetimeLocalValue(evento.data_inicio)}
              />
              <p className="text-xs text-zinc-500">
                Sem horário de fim: o evento pode durar várias horas (show, feijoada, etc.).
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="local">
              Local
            </label>
            <input
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="local"
              name="local"
              required
              defaultValue={evento.local}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="cidade">
              Cidade (para filtros)
            </label>
            <input
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="cidade"
              name="cidade"
              defaultValue={evento.cidade ?? ""}
              placeholder="Ex.: São Paulo"
            />
          </div>

          <div className="grid gap-2">
            <EventoLotesEditor rows={loteRows} onChange={setLoteRows} />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="limite_ingressos_por_cpf">
              Limite por CPF (opcional)
            </label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="limite_ingressos_por_cpf"
              name="limite_ingressos_por_cpf"
              type="number"
              min={1}
              max={50}
              defaultValue={evento.limite_ingressos_por_cpf ?? ""}
              placeholder="Vazio = sem limite"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="mensagem_confirmacao">
              Mensagem de confirmação (opcional)
            </label>
            <textarea
              className="min-h-[80px] rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="mensagem_confirmacao"
              name="mensagem_confirmacao"
              maxLength={2000}
              defaultValue={evento.mensagem_confirmacao ?? ""}
            />
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <p className="text-sm font-medium text-zinc-900">Visibilidade</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="publicado"
                value="true"
                defaultChecked={evento.publicado}
                className="mt-1"
              />
              <span>
                <strong className="font-semibold">Publicar</strong> — na vitrine e com venda.
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
              <input
                type="radio"
                name="publicado"
                value="false"
                defaultChecked={!evento.publicado}
                className="mt-1"
              />
              <span>
                <strong className="font-semibold">Pausar</strong> — fora da vitrine; sem venda.
              </span>
            </label>
            <EventoVisibilidadeAvisosLegais />
          </div>

          <EventoImagemField value={imagemUrl} onChange={setImagemUrl} />

          <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4">
            <button disabled={saving} className="btn-success px-8" type="submit">
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-zinc-100 pt-6">
          <EventoCuponsEditor eventoId={evento.id} />
          <p className="mt-2 text-xs text-zinc-500">
            Cupons são salvos na hora em &quot;Adicionar&quot;. O botão acima guarda só os dados do evento.
          </p>
        </div>
      </div>
    </div>
  );
}
