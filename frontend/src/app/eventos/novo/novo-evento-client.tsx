"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { EventoImagemField } from "@/components/evento-imagem-field";
import {
  checklistPublicacaoPronta,
  EventoPublicarChecklist,
} from "@/components/evento-publicar-checklist";
import {
  defaultLoteRows,
  EventoLotesEditor,
  lotesRowsToApiPayload,
  precoMinimoDosLotes,
  type LoteFormRow,
} from "@/components/evento-lotes-editor";
import { EventoConfigAvancadaFields } from "@/components/evento-config-avancada-fields";
import { EventoVisibilidadeAvisosLegais } from "@/components/evento-visibilidade-avisos";
import { EventoWizardSimuladorLiquido } from "@/components/evento-wizard-simulador-liquido";
import { InputValorBrl } from "@/components/input-valor-brl";
import { INGRESSO_MINIMO_PAGO_REAIS } from "@/lib/taxas-asaas-publicas";
import { parseEventoConfigFromForm } from "@/lib/evento-config-avancada";
import { EVENTO_CATEGORIAS, slugFromNome } from "@/lib/eventos";
import { apiFetch } from "@/lib/api";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { parseValorMonetarioInput, type PlanoTarifaId } from "@/lib/tarifas-plataforma";

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
  cidade?: string | null;
  imagem_url?: string | null;
  preco_ingresso: number;
  ingresso_lotes: ReturnType<typeof lotesRowsToApiPayload>;
  categoria: string;
  mensagem_confirmacao?: string | null;
  publicado: boolean;
  limite_ingressos_por_cpf?: number | null;
  urgencia_modo?: string;
  parcelamento_habilitado?: boolean;
  parcelamento_max?: number;
  aceita_interesse?: boolean;
  lista_espera_habilitada?: boolean;
  lista_espera_prazo_horas?: number;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{children}</h2>
  );
}

const WIZARD_STEPS = [
  { id: 1, label: "Básico" },
  { id: 2, label: "Ingresso" },
  { id: 3, label: "Publicar" },
] as const;

function WizardBar({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex gap-2" aria-label="Progresso do formulário">
      {WIZARD_STEPS.map((s) => {
        const ativo = s.id === step;
        const feito = s.id < step;
        return (
          <li
            key={s.id}
            className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-semibold ${
              ativo
                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                : feito
                  ? "border-emerald-200 bg-white text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}
          >
            {s.id}. {s.label}
          </li>
        );
      })}
    </ol>
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
  const [wizardStep, setWizardStep] = useState(1);
  const [modoSimples, setModoSimples] = useState(true);
  const [precoSimples, setPrecoSimples] = useState(() => moedaBrlFromNumber(49.9));
  const [eventoGratuito, setEventoGratuito] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formDataInicio, setFormDataInicio] = useState("");
  const [formLocal, setFormLocal] = useState("");
  const [formPublicado, setFormPublicado] = useState(false);
  const [repasseAprovado, setRepasseAprovado] = useState(false);
  const [parcelamentoHabilitado, setParcelamentoHabilitado] = useState(false);
  const [parcelamentoMax, setParcelamentoMax] = useState(2);
  const [repasseParcelamento, setRepasseParcelamento] = useState<"comprador" | "organizador">("comprador");
  const [planoTarifa, setPlanoTarifa] = useState<PlanoTarifaId>("padrao");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    void apiFetch<{ plano_tarifa?: string }>("/api/organizador/financeiro/saldo")
      .then((s) => {
        if (s.plano_tarifa === "assinatura") setPlanoTarifa("assinatura");
      })
      .catch(() => {});
    void apiFetch<{ repasse_aprovado?: boolean }>("/api/organizador/asaas", { cache: "no-store" })
      .then((s) => setRepasseAprovado(Boolean(s.repasse_aprovado)))
      .catch(() => setRepasseAprovado(false));
  }, []);

  const slugPrev = slugFromNome(nomeParaSlug);
  const voltarHref = painel ? "/organizador/eventos" : "/eventos";

  const checklistProps = {
    nome: formNome,
    descricao: formDescricao,
    dataInicio: formDataInicio,
    local: formLocal,
    imagemUrl,
    modoSimples,
    eventoGratuito,
    precoSimples,
    loteRowsCount: loteRows.length,
    publicado: formPublicado,
    repasseAprovado,
  };
  const prontoPublicar = checklistPublicacaoPronta(checklistProps);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    let rows = loteRows;
    if (modoSimples) {
      if (eventoGratuito) {
        rows = [
          {
            nome: "Cortesia",
            tipo: "cortesia",
            preco: moedaBrlFromNumber(0),
            ordem: 1,
            quantidade_maxima: "",
            ativo: true,
            vendas_inicio: "",
            vendas_fim: "",
          },
        ];
      } else {
        rows = [
          {
            nome: "Geral",
            tipo: "inteira",
            preco: precoSimples.trim() || moedaBrlFromNumber(49.9),
            ordem: 1,
            quantidade_maxima: "",
            ativo: true,
            vendas_inicio: "",
            vendas_fim: "",
          },
        ];
      }
    }

    const preco_ingresso = precoMinimoDosLotes(rows);
    const lotesPayload = lotesRowsToApiPayload(rows);
    for (const l of lotesPayload) {
      if (l.tipo === "cortesia") continue;
      if (!Number.isFinite(l.preco) || l.preco < INGRESSO_MINIMO_PAGO_REAIS) {
        setError(
          `Informe um preço válido (mínimo R$ ${INGRESSO_MINIMO_PAGO_REAIS.toFixed(2).replace(".", ",")}) ou marque evento gratuito.`,
        );
        setLoading(false);
        return;
      }
    }
    const temPago = lotesPayload.some((l) => l.tipo !== "cortesia");
    if (temPago && (!Number.isFinite(preco_ingresso) || preco_ingresso < INGRESSO_MINIMO_PAGO_REAIS)) {
      setError(
        `Informe pelo menos um lote pago com preço mínimo de R$ ${INGRESSO_MINIMO_PAGO_REAIS.toFixed(2).replace(".", ",")}.`,
      );
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
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      imagem_url: imagemUrl.trim() || null,
      preco_ingresso,
      ingresso_lotes: lotesPayload,
      categoria: String(formData.get("categoria") ?? "Outros"),
      mensagem_confirmacao: msg || null,
      publicado,
      limite_ingressos_por_cpf:
        limite_ingressos_por_cpf && limite_ingressos_por_cpf >= 1 ? limite_ingressos_por_cpf : null,
      ...parseEventoConfigFromForm(formData),
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
            {painel
              ? "Siga as 3 etapas abaixo. Comece pelo básico e publique quando estiver pronto."
              : "Três passos simples: informações, ingresso e publicação."}
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-600 bg-white p-6 shadow-md ring-1 ring-emerald-600 sm:mt-12 sm:p-8">
          <WizardBar step={wizardStep} />
          <form ref={formRef} action={onSubmit} className="space-y-0">
            {error ? (
              <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className={wizardStep === 1 ? "space-y-0" : "hidden"} aria-hidden={wizardStep !== 1}>
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
                  value={formNome}
                  onChange={(e) => {
                    setFormNome(e.target.value);
                    setNomeParaSlug(e.target.value);
                  }}
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
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
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
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                  />
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
                  value={formLocal}
                  onChange={(e) => setFormLocal(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="cidade">
                  Cidade (para filtros)
                </label>
                <input
                  className={inputClass}
                  id="cidade"
                  name="cidade"
                  placeholder="Ex.: São Paulo — ou deixe vazio para inferir do local"
                />
              </div>
            </section>
            </div>

            <div className={wizardStep === 2 ? "space-y-0" : "hidden"} aria-hidden={wizardStep !== 2}>
            <section className="space-y-4">
              <SectionTitle>Ingresso</SectionTitle>
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={modoSimples}
                  onChange={(e) => setModoSimples(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Modo simples (recomendado para começar)
              </label>
              {modoSimples ? (
                <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                    <input
                      type="checkbox"
                      checked={eventoGratuito}
                      onChange={(e) => setEventoGratuito(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    Evento gratuito (cortesia)
                  </label>
                  {!eventoGratuito ? (
                    <div className="grid max-w-xs gap-2">
                      <label className="text-sm font-medium text-zinc-800" htmlFor="preco_simples">
                        Preço do ingresso
                      </label>
                      <InputValorBrl
                        id="preco_simples"
                        value={precoSimples}
                        onChange={setPrecoSimples}
                        placeholder="49,90"
                      />
                    </div>
                  ) : null}
                  <EventoWizardSimuladorLiquido
                    preco={precoSimples}
                    ocultar={eventoGratuito}
                    parcelamentoHabilitado={parcelamentoHabilitado}
                    parcelamentoMax={parcelamentoMax}
                    repasseParcelamento={repasseParcelamento}
                    planoTarifa={planoTarifa}
                  />
                </div>
              ) : (
                <EventoLotesEditor rows={loteRows} onChange={setLoteRows} />
              )}
            </section>

            <div className="my-8 border-t border-emerald-100" aria-hidden />

            <section className="space-y-3">
              <EventoImagemField value={imagemUrl} onChange={setImagemUrl} />
            </section>
            </div>

            <div className={wizardStep === 3 ? "space-y-0" : "hidden"} aria-hidden={wizardStep !== 3}>
            <EventoPublicarChecklist {...checklistProps} />
            <section className="mt-6 space-y-4">
              <SectionTitle>Visibilidade</SectionTitle>
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-4 ring-1 ring-emerald-200/80 sm:p-5">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-emerald-300 hover:bg-white">
                  <input
                    type="radio"
                    name="publicado"
                    value="true"
                    checked={formPublicado}
                    disabled={!eventoGratuito && !repasseAprovado}
                    onChange={() => setFormPublicado(true)}
                    className="mt-1 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                  />
                  <span className="text-sm text-zinc-800">
                    <span className="font-semibold text-zinc-900">Publicar</span> — aparece na
                    listagem pública e qualquer pessoa pode abrir a página e comprar ingresso.
                    {!eventoGratuito && !repasseAprovado ? (
                      <span className="mt-1 block text-xs text-amber-800">
                        Requer conta de repasses aprovada.{" "}
                        <Link href="/organizador/financeiro/conta-repasse" className="font-medium underline">
                          Configurar em Financeiro
                        </Link>
                      </span>
                    ) : null}
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-emerald-300 hover:bg-white">
                  <input
                    type="radio"
                    name="publicado"
                    value="false"
                    checked={!formPublicado}
                    onChange={() => setFormPublicado(false)}
                    className="mt-1 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-sm text-zinc-800">
                    <span className="font-semibold text-zinc-900">Pausar</span> — não aparece na
                    vitrine; só o organizador logado acessa o link. Venda desativada até republicar.
                  </span>
                </label>
                <EventoConfigAvancadaFields
                  onParcelamentoChange={(hab, max, repasse) => {
                    setParcelamentoHabilitado(hab);
                    setParcelamentoMax(max);
                    if (repasse) setRepasseParcelamento(repasse);
                  }}
                />
                <EventoWizardSimuladorLiquido
                  preco={modoSimples ? precoSimples : precoMinimoDosLotes(loteRows)}
                  ocultar={
                    eventoGratuito ||
                    (modoSimples
                      ? (parseValorMonetarioInput(precoSimples) ?? 0) < 10
                      : precoMinimoDosLotes(loteRows) < 10)
                  }
                  parcelamentoHabilitado={parcelamentoHabilitado}
                  parcelamentoMax={parcelamentoMax}
                  repasseParcelamento={repasseParcelamento}
                  planoTarifa={planoTarifa}
                />
                <EventoVisibilidadeAvisosLegais />
              </div>
            </section>
            </div>

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-emerald-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={voltarHref}
                className="btn-outline justify-center px-6 py-3 text-center text-sm shadow-sm sm:inline-flex sm:min-w-0"
              >
                Cancelar
              </Link>
              <div className="flex flex-col gap-2 sm:flex-row">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    className="btn-outline px-6 py-3 text-sm"
                    onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                  >
                    ← Anterior
                  </button>
                ) : null}
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    className="btn-success px-8 py-3 text-base shadow-sm"
                    onClick={() => {
                      if (wizardStep === 1 && formRef.current && !formRef.current.reportValidity()) return;
                      setWizardStep((s) => Math.min(3, s + 1));
                    }}
                  >
                    Próximo →
                  </button>
                ) : (
                  <button
                    disabled={loading || !prontoPublicar}
                    className="btn-success px-8 py-3 text-base shadow-sm sm:min-w-[11rem] disabled:opacity-50"
                    type="submit"
                  >
                    {loading ? "Criando…" : "Criar evento"}
                  </button>
                )}
              </div>
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
