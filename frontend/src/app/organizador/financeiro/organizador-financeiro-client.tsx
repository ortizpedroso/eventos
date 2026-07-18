"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { OrganizadorFinanceiroSimulador } from "@/components/organizador-financeiro-simulador";
import { OrganizadorRepassesPainel } from "@/components/organizador-repasses-painel";
import { apiFetch } from "@/lib/api";
import { AVISO_LEGAL_TAXAS } from "@/lib/taxas-asaas-publicas";
import type { PlanoTarifaId } from "@/lib/tarifas-plataforma";

type FinanceiroResumo = {
  resumo: {
    receita_confirmada: number;
    receita_em_aberto: number;
    total_ingressos: number;
  };
  financeiro?: {
    receita_bruta: number;
    taxa_plataforma_estimada: number;
    liquido_estimado: number;
    rotulo_taxa?: string;
    nota: string;
  };
  mes_atual: {
    referencia: string;
    receita_confirmada: number;
  };
};

type AssinaturaStatus = {
  assinatura_ativa: boolean;
  valida_ate: string | null;
  mensalidade_reais: number;
  taxa_efetiva: PlanoTarifaId;
};

type PixData = {
  encoded_image?: string;
  copia_cola?: string;
  expiration_date?: string;
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PixCard({
  pix,
  onPago,
}: {
  pix: PixData;
  onPago: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      const r = await apiFetch<{ sincronizado: boolean; assinatura_ativa?: boolean }>(
        "/api/organizador/assinatura/sincronizar",
        { method: "POST" },
      );
      if (r.assinatura_ativa) {
        if (pollRef.current) clearInterval(pollRef.current);
        onPago();
      }
    } catch {
      /* ignore */
    } finally {
      setVerificando(false);
    }
  }, [onPago]);

  useEffect(() => {
    pollRef.current = setInterval(() => void verificar(), 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [verificar]);

  async function copiar() {
    if (!pix.copia_cola) return;
    try {
      await navigator.clipboard.writeText(pix.copia_cola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      /* fallback: select text */
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-indigo-950">Pague via PIX para ativar</h2>
        <p className="mt-1 text-xs text-indigo-800">
          Após o pagamento, a taxa reduzida é ativada automaticamente.
          {pix.expiration_date ? ` Válido até ${new Date(pix.expiration_date).toLocaleString("pt-BR")}.` : ""}
        </p>
      </div>

      {pix.encoded_image ? (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${pix.encoded_image}`}
            alt="QR Code PIX"
            className="h-48 w-48 rounded-lg border border-indigo-200 bg-white p-2"
          />
        </div>
      ) : null}

      {pix.copia_cola ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-indigo-900">Código copia e cola:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={pix.copia_cola}
              className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 font-mono text-xs text-zinc-700"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={() => void copiar()}
              className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-800 transition hover:bg-indigo-50"
            >
              {copiado ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={verificando}
        onClick={() => void verificar()}
        className="w-full rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {verificando ? "Verificando…" : "Já paguei — verificar"}
      </button>
      <p className="text-center text-xs text-indigo-700">Verificação automática a cada 10 segundos</p>
    </section>
  );
}

export function OrganizadorFinanceiroClient() {
  const [data, setData] = useState<FinanceiroResumo | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaStatus | null>(null);
  const [planoTarifa, setPlanoTarifa] = useState<PlanoTarifaId>("padrao");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyAssinatura, setBusyAssinatura] = useState(false);
  const [pixPendente, setPixPendente] = useState<PixData | null>(null);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const [r, saldo, ass] = await Promise.all([
        apiFetch<FinanceiroResumo>("/api/relatorios/organizador?dias=90", { cache: "no-store" }),
        apiFetch<{ plano_tarifa?: string }>("/api/organizador/financeiro/saldo", { cache: "no-store" }),
        apiFetch<AssinaturaStatus>("/api/organizador/assinatura", { cache: "no-store" }),
      ]);
      setData(r);
      setAssinatura(ass);
      const efetivo = (ass.taxa_efetiva || saldo.plano_tarifa || "padrao") as PlanoTarifaId;
      setPlanoTarifa(efetivo === "assinatura" ? "assinatura" : "padrao");
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Não foi possível carregar o resumo financeiro.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function contratarAssinatura() {
    setBusyAssinatura(true);
    setMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{
        ja_pago?: boolean;
        pix?: PixData;
      }>("/api/organizador/assinatura/pagar", { method: "POST" });

      if (res.ja_pago) {
        setMsg("Assinatura ativada com sucesso.");
        await carregar();
        return;
      }
      if (res.pix) {
        setPixPendente(res.pix);
      } else {
        setMsg("Cobrança gerada. Entre em contato com o suporte caso não receba instruções de pagamento.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível iniciar a assinatura.");
    } finally {
      setBusyAssinatura(false);
    }
  }

  function handlePagamentoConfirmado() {
    setPixPendente(null);
    setMsg("Assinatura ativada com sucesso! Taxa reduzida já está aplicada nas suas vendas.");
    void carregar();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Financeiro</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Acompanhe vendas por período, saldo com carência de 48h e solicite transferências Pix direto na plataforma —{" "}
          <Link href="/planos" className="font-medium text-emerald-800 underline underline-offset-2">
            ver planos
          </Link>
          .
        </p>
        <p className="mt-2 text-[11px] text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
      </div>

      {pixPendente ? (
        <PixCard pix={pixPendente} onPago={handlePagamentoConfirmado} />
      ) : assinatura && !assinatura.assinatura_ativa ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
          <h2 className="text-sm font-semibold text-indigo-950">Plano com assinatura</h2>
          <p className="mt-1 text-sm text-indigo-900">
            Taxa reduzida por ingresso + mensalidade de {fmtBRL(assinatura.mensalidade_reais)}.
          </p>
          <button
            type="button"
            disabled={busyAssinatura}
            className="mt-3 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void contratarAssinatura()}
          >
            {busyAssinatura ? "Gerando PIX…" : "Contratar assinatura via PIX"}
          </button>
        </section>
      ) : assinatura?.assinatura_ativa ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Assinatura ativa
          {assinatura.valida_ate
            ? ` até ${new Date(assinatura.valida_ate).toLocaleDateString("pt-BR")}`
            : ""}
          . Taxa reduzida aplicada nas vendas.
        </p>
      ) : null}

      <OrganizadorRepassesPainel />
      <OrganizadorFinanceiroSimulador planoTarifa={planoTarifa} />

      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {data?.financeiro ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Resumo por ingressos pagos</h2>
          <p className="mt-1 text-xs text-zinc-500">{data.financeiro.nota}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">Receita bruta</p>
              <p className="text-xl font-bold text-zinc-900">{fmtBRL(data.financeiro.receita_bruta)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Taxa EventosBR</p>
              <p className="text-xl font-bold text-amber-900">{fmtBRL(data.financeiro.taxa_plataforma_estimada)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total repassado</p>
              <p className="text-xl font-bold text-emerald-800">{fmtBRL(data.financeiro.liquido_estimado)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
        </section>
      ) : null}

      <ul className="space-y-3 text-sm">
        <li>
          <Link
            href="/organizador/relatorios"
            className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-3 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 transition hover:bg-emerald-50"
          >
            Relatórios por evento →
          </Link>
        </li>
      </ul>
    </div>
  );
}
