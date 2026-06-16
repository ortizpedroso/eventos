"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatCpfMask, onlyDigits } from "@/lib/cpf";

type AsaasStatus = {
  asaas_ativo: boolean;
  payments_disabled: boolean;
  wallet_id: string | null;
  wallet_configurado: boolean;
  account_id: string | null;
  tem_subconta: boolean;
  repasses_prontos: boolean;
  eventos_sem_wallet: number;
  nota_wallet: string | null;
  anticipacao: {
    disponivel: boolean;
    credit_card_automatic_enabled: boolean | null;
  };
};

type Simulacao = {
  modo: string;
  valor_bruto: number;
  taxa_plataforma: number;
  liquido_apos_taxa?: number;
  taxa_antecipacao_estimada?: number;
  liquido_antecipado_estimado?: number;
  taxa_antecipacao_mes_pct?: number;
  nota?: string;
  simulacao?: Record<string, unknown>;
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrganizadorAsaasPainel() {
  const [status, setStatus] = useState<AsaasStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [walletId, setWalletId] = useState("");
  const [mostrarSubconta, setMostrarSubconta] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [renda, setRenda] = useState("5000");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [simValor, setSimValor] = useState("100");
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const s = await apiFetch<AsaasStatus>("/api/organizador/asaas", { cache: "no-store" });
      setStatus(s);
      if (s.wallet_id) setWalletId(s.wallet_id);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Não foi possível carregar dados Asaas.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarWallet(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{ mensagem: string }>("/api/organizador/asaas/wallet", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet_id: walletId.trim(), sincronizar_eventos: true }),
      });
      setMsg(r.mensagem);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o walletId.");
    } finally {
      setBusy(false);
    }
  }

  async function criarSubconta(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{ mensagem: string }>("/api/organizador/asaas/subconta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cpf_cnpj: onlyDigits(cpfCnpj, 14),
          telefone: onlyDigits(telefone, 11),
          renda_mensal: Number(renda.replace(",", ".")),
          cep: onlyDigits(cep, 8),
          endereco: endereco.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          company_type: onlyDigits(cpfCnpj, 14).length > 11 ? "LIMITED" : "INDIVIDUAL",
        }),
      });
      setMsg(r.mensagem);
      setMostrarSubconta(false);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar subconta.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAntecipacao(habilitar: boolean) {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{ mensagem: string }>("/api/organizador/asaas/antecipacao", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credit_card_automatic_enabled: habilitar }),
      });
      setMsg(r.mensagem);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar antecipação.");
    } finally {
      setBusy(false);
    }
  }

  async function simular(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const valor = Number(simValor.replace(",", "."));
      const r = await apiFetch<Simulacao>("/api/organizador/asaas/antecipacao/simular", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor_reais: valor }),
      });
      setSimulacao(r);
    } catch (err) {
      setSimulacao(null);
      setError(err instanceof Error ? err.message : "Não foi possível simular.");
    } finally {
      setBusy(false);
    }
  }

  if (!status && !error) {
    return <p className="text-sm text-zinc-600">A carregar conta Asaas…</p>;
  }

  const desativado = status?.payments_disabled || !status?.asaas_ativo;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Conta Asaas — repasses</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Configure onde você recebe o líquido das vendas. O EventosBR usa split automático: taxa da
        plataforma + valor para sua carteira Asaas.
      </p>

      {desativado ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Asaas desativado neste ambiente (modo teste). Em produção, ative{" "}
          <code className="rounded bg-amber-100 px-1">ASAAS_API_KEY</code> no servidor.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}

      {status ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              status.repasses_prontos
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {status.repasses_prontos ? "Repasses configurados" : "Wallet pendente"}
          </span>
          {status.tem_subconta ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
              Subconta vinculada
            </span>
          ) : null}
          {status.eventos_sem_wallet > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
              {status.eventos_sem_wallet} evento(s) sem wallet
            </span>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={salvarWallet} className="mt-5 space-y-3">
        <label htmlFor="asaas-wallet" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          walletId (Asaas)
        </label>
        <input
          id="asaas-wallet"
          type="text"
          value={walletId}
          onChange={(e) => setWalletId(e.target.value)}
          placeholder="Cole o walletId da sua conta Asaas"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 font-mono text-sm"
          disabled={busy || desativado}
        />
        {status?.nota_wallet ? (
          <p className="text-xs text-zinc-500">{status.nota_wallet}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy || desativado || !walletId.trim()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "Salvando…" : "Salvar conta de repasse"}
        </button>
      </form>

      {status && !status.tem_subconta && !desativado ? (
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <button
            type="button"
            onClick={() => setMostrarSubconta((v) => !v)}
            className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            {mostrarSubconta ? "Ocultar criação de subconta" : "Criar subconta Asaas pela plataforma"}
          </button>
          {mostrarSubconta ? (
            <form onSubmit={criarSubconta} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-600">CPF ou CNPJ</label>
                <input
                  value={formatCpfMask(cpfCnpj)}
                  onChange={(e) => setCpfCnpj(onlyDigits(e.target.value, 14))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600">Telefone (DDD)</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(onlyDigits(e.target.value, 11))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600">Renda mensal (R$)</label>
                <input
                  value={renda}
                  onChange={(e) => setRenda(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600">CEP</label>
                <input
                  value={cep}
                  onChange={(e) => setCep(onlyDigits(e.target.value, 8))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-zinc-600">Endereço</label>
                <input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600">Número</label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600">Bairro</label>
                <input
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {busy ? "Criando…" : "Criar subconta"}
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  Requer conta raiz Asaas com CNPJ. A chave da subconta fica armazenada de forma segura
                  para antecipação opt-in.
                </p>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {status?.anticipacao.disponivel ? (
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <h3 className="text-sm font-semibold text-zinc-900">Antecipação no cartão (opt-in)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Receba vendas no cartão em até ~2 dias úteis. Você controla quando ativar — não é automático
            para todos.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(status.anticipacao.credit_card_automatic_enabled)}
              disabled={busy}
              onChange={(e) => void toggleAntecipacao(e.target.checked)}
            />
            Antecipação automática no cartão de crédito
          </label>
        </div>
      ) : null}

      <form onSubmit={simular} className="mt-6 border-t border-zinc-100 pt-5">
        <h3 className="text-sm font-semibold text-zinc-900">Simulador de líquido</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Estimativa após taxa EventosBR e antecipação ilustrativa no cartão.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-zinc-600">Valor do ingresso (R$)</label>
            <input
              value={simValor}
              onChange={(e) => setSimValor(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            Simular
          </button>
        </div>
        {simulacao ? (
          <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm">
            <p>
              Bruto: <strong>{fmtBRL(simulacao.valor_bruto)}</strong> · Taxa plataforma:{" "}
              <strong>{fmtBRL(simulacao.taxa_plataforma)}</strong>
            </p>
            {simulacao.modo === "estimativa" && simulacao.liquido_antecipado_estimado != null ? (
              <p className="mt-1 text-emerald-800">
                Líquido estimado (com antecipação ~{simulacao.taxa_antecipacao_mes_pct?.toFixed(2)}% a.m.):{" "}
                <strong>{fmtBRL(simulacao.liquido_antecipado_estimado)}</strong>
              </p>
            ) : null}
            {simulacao.nota ? <p className="mt-2 text-xs text-zinc-500">{simulacao.nota}</p> : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}
