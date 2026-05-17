"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { EventoImagemField } from "@/components/evento-imagem-field";
import {
  defaultLoteRows,
  EventoLotesEditor,
  lotesRowsToApiPayload,
  precoMinimoDosLotes,
  type LoteFormRow,
} from "@/components/evento-lotes-editor";
import { EventoVisibilidadeAvisosLegais } from "@/components/evento-visibilidade-avisos";
import { EVENTO_CATEGORIAS, slugFromNome } from "@/lib/eventos";
import { apiFetch } from "@/lib/api";

const CATEGORIAS = EVENTO_CATEGORIAS;

const inputClass =
  "h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm text-zinc-900 shadow-sm transition-colors hover:border-emerald-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";
const textareaClass =
  "w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors hover:border-emerald-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

type CriarEventoPayload = {
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  imagem_url?: string | null;
  preco_ingresso: number;
  ingresso_lotes: ReturnType<typeof lotesRowsToApiPayload>;
  categoria: string;
  mensagem_confirmacao?: string | null;
  publicado: boolean;
  limite_ingressos_por_cpf?: number | null;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{children}</h2>
  );
}

export type NovoEventoFormVariant = "standalone" | "painel";

type Props = {
  /** `painel`: dentro do layout do organizador (menu lateral). */
  variant?: NovoEventoFormVariant;
};

export function NovoEventoForm({ variant = "standalone" }: Props) {
  const router = useRouter();
  const painel = variant === "painel";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nomeParaSlug, setNomeParaSlug] = useState("");
  const [origin, setOrigin] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [loteRows, setLoteRows] = useState<LoteFormRow[]>(() => defaultLoteRows());

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const slugPrev = slugFromNome(nomeParaSlug);
  const voltarHref = painel ? "/organizador/eventos" : "/eventos";

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const preco_ingresso = precoMinimoDosLotes(loteRows);
    const lotesPayload = lotesRowsToApiPayload(loteRows);
    for (const l of lotesPayload) {
      if (l.tipo === "cortesia") continue;
      if (!Number.isFinite(l.preco) || l.preco < 0.5) {
        setError("Cada lote pago precisa de preço válido (mínimo R$ 0,50). Cortesia usa R$ 0.");
        setLoading(false);
        return;
      }
    }
    const temPago = lotesPayload.some((l) => l.tipo !== "cortesia");
    if (temPago && (!Number.isFinite(preco_ingresso) || preco_ingresso < 0.5)) {
      setError("Informe pelo menos um lote pago com preço mínimo de R$ 0,50.");
      setLoading(false);
      return;
    }

    const rawIni = String(formData.get("data_inicio") ?? "").trim();
    const di = new Date(rawIni);
    if (!Number.isFinite(di.getTime())) {
      setError("Data de início inválida.");
      setLoading(false);
      return;
    }

    const msg = String(formData.get("mensagem_confirmacao") ?? "").trim();
    const publicado = String(formData.get("publicado") ?? "true") !== "false";
    const limiteRaw = String(formData.get("limite_ingressos_por_cpf") ?? "").trim();
    const limite_ingressos_por_cpf = limiteRaw ? Number.parseInt(limiteRaw, 10) : null;

    const payload: CriarEventoPayload = {
      nome: String(formData.get("nome") ?? ""),
      descricao: String(formData.get("descricao") ?? ""),
      data_inicio: rawIni,
      data_fim: rawIni,
      local: String(formData.get("local") ?? ""),
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
      const evento = await apiFetch<{ slug: string; publicado: boolean }>("/api/eventos/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (evento.publicado) {
        router.push(painel ? "/organizador/eventos" : "/eventos");
      } else {
        router.push(`/eventos/${evento.slug}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar evento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={painel ? "py-0" : "py-16 sm:py-24 lg:py-28"}>
      <div className={`mx-auto w-full max-w-2xl ${painel ? "" : "px-4 sm:px-6 lg:px-8"}`}>
        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Organizador
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Novo <span className="text-emerald-700">evento</span>
          </h1>
          <p className="mt-4 text-lg text-zinc-600 sm:text-xl">
            {painel ? (
              <>
                Campos agrupados por etapa. O link público fica{" "}
                <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800">
                  /eventos/
                </code>{" "}
                + nome em formato de URL. Em <span className="font-medium text-zinc-800">Visibilidade</span>{" "}
                você decide se já aparece na vitrine ou se o evento fica pausado até você publicar.
              </>
            ) : (
              <>
                Preencha os dados abaixo. O endereço público será{" "}
                <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800">
                  /eventos/
                </code>{" "}
                seguido do nome em formato URL (slug). Publique na vitrine ou deixe pausado até estar
                pronto.
              </>
            )}
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:mt-12 sm:p-8">
          <form action={onSubmit} className="space-y-0">
            {error ? (
              <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <section className="space-y-4">
              <SectionTitle>Identidade</SectionTitle>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="nome">
                  Nome do evento
                </label>
                <input
                  className={inputClass}
                  id="nome"
                  name="nome"
                  required
                  placeholder="Ex.: Conferência Tech Brasil 2026"
                  onChange={(e) => setNomeParaSlug(e.target.value)}
                />
              </div>
              <div className="rounded-2xl border border-emerald-600 bg-gradient-to-b from-emerald-50/90 to-white p-4 shadow-sm ring-1 ring-emerald-600 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Sua página pública
                </p>
                <p className="mt-2 break-all font-mono text-sm text-emerald-950">
                  <span className="text-zinc-600">{origin || "…"}</span>
                  /eventos/{slugPrev}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900/90">
                  O slug é gerado a partir do nome. Se já existir outro evento com o mesmo slug, o
                  sistema acrescenta um número ao final (ex.: <span className="font-mono">-1</span>
                  ).
                </p>
              </div>
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-4">
              <SectionTitle>Conteúdo</SectionTitle>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="descricao">
                  Descrição
                </label>
                <textarea
                  className={`${textareaClass} min-h-[120px]`}
                  id="descricao"
                  name="descricao"
                  required
                  placeholder="Conte o que o participante pode esperar…"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="categoria">
                  Categoria
                </label>
                <select
                  id="categoria"
                  name="categoria"
                  className={inputClass}
                  defaultValue="Outros"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-4">
              <SectionTitle>Data e local</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2 sm:max-w-md">
                  <label className="text-sm font-medium text-zinc-800" htmlFor="data_inicio">
                    Data e hora de início
                  </label>
                  <input
                    className={inputClass}
                    id="data_inicio"
                    name="data_inicio"
                    type="datetime-local"
                    step={60}
                    required
                  />
                  <p className="text-xs text-zinc-500">
                    Não pedimos horário de fim: o evento pode durar o tempo que for (show, feijoada,
                    etc.).
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="local">
                  Local
                </label>
                <input
                  className={inputClass}
                  id="local"
                  name="local"
                  required
                  placeholder="Endereço ou link para mapa"
                />
              </div>
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-4">
              <SectionTitle>Ingresso</SectionTitle>
              <EventoLotesEditor rows={loteRows} onChange={setLoteRows} />
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="limite_ingressos_por_cpf">
                  Limite por CPF <span className="font-normal text-zinc-500">(opcional)</span>
                </label>
                <input
                  className={inputClass}
                  id="limite_ingressos_por_cpf"
                  name="limite_ingressos_por_cpf"
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Ex.: 2 (vazio = sem limite)"
                />
                <p className="text-xs text-zinc-500">
                  Máximo de ingressos ativos com o mesmo CPF neste evento.
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="mensagem_confirmacao">
                  Mensagem de confirmação <span className="font-normal text-zinc-500">(opcional)</span>
                </label>
                <textarea
                  className={`${textareaClass} min-h-[88px]`}
                  id="mensagem_confirmacao"
                  name="mensagem_confirmacao"
                  maxLength={2000}
                  placeholder="Ex.: Obrigado pela inscrição! Leve este comprovante no dia do evento."
                />
                <p className="text-xs text-zinc-500">
                  Exibida ao comprador após o pagamento (área &quot;Meus pagamentos&quot;).
                </p>
              </div>
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-4">
              <SectionTitle>Visibilidade</SectionTitle>
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-4 ring-1 ring-emerald-200/80 sm:p-5">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-emerald-300 hover:bg-white">
                  <input
                    type="radio"
                    name="publicado"
                    value="true"
                    defaultChecked
                    className="mt-1 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-sm text-zinc-800">
                    <span className="font-semibold text-zinc-900">Publicar</span> — aparece na
                    listagem pública e qualquer pessoa pode abrir a página e comprar ingresso.
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-emerald-300 hover:bg-white">
                  <input
                    type="radio"
                    name="publicado"
                    value="false"
                    className="mt-1 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-sm text-zinc-800">
                    <span className="font-semibold text-zinc-900">Pausar</span> — não aparece na
                    vitrine; só o organizador logado acessa o link. Venda desativada até republicar.
                  </span>
                </label>
                <EventoVisibilidadeAvisosLegais />
              </div>
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-3">
              <EventoImagemField value={imagemUrl} onChange={setImagemUrl} />
            </section>

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-emerald-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={voltarHref}
                className="btn-outline justify-center px-6 py-3 text-center text-sm shadow-sm sm:inline-flex sm:min-w-0"
              >
                Cancelar
              </Link>
              <button
                disabled={loading}
                className="btn-success px-8 py-3 text-base shadow-sm sm:min-w-[11rem]"
                type="submit"
              >
                {loading ? "Criando…" : "Criar evento"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500 sm:text-left">
          <Link
            href={voltarHref}
            className="font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
          >
            {painel ? "← Voltar aos meus eventos" : "← Ver todos os eventos"}
          </Link>
        </p>
      </div>
    </div>
  );
}
