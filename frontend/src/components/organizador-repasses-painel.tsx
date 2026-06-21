"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import { apiFetch } from "@/lib/api";
import { formatCpfMask, onlyDigits } from "@/lib/cpf";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { parseValorMonetarioInput } from "@/lib/tarifas-plataforma";

type RepasseStatus = {
  asaas_ativo: boolean;
  payments_disabled: boolean;
  wallet_configurado: boolean;
  tem_subconta: boolean;
  repasses_prontos: boolean;
  eventos_sem_wallet: number;
  nota_wallet: string | null;
};

type Saldo = {
  plano_tarifa: string;
  rotulo_taxa: string;
  receita_bruta: number;
  taxa_plataforma_total: number;
  liquido_acumulado: number;
  saques_reservados: number;
  saldo_disponivel: number;
  ingressos_pagos: number;
};

type Movimento =
  | {
      tipo: "venda";
      id: string;
      data: string | null;
      evento_nome: string;
      valor_ingresso: number;
      taxa_plataforma: number;
      liquido: number;
      descricao: string;
    }
  | {
      tipo: "saque";
      id: string;
      data: string | null;
      valor: number;
      status: string;
      pix_chave: string;
      descricao: string;
    };

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrganizadorRepassesPainel() {
  const [status, setStatus] = useState<RepasseStatus | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mostrarSubconta, setMostrarSubconta] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [renda, setRenda] = useState(() => moedaBrlFromNumber(5000));
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");

  const [saqueValor, setSaqueValor] = useState(() => moedaBrlFromNumber(100));
  const [pixChave, setPixChave] = useState("");

  const carregar = useCallback(async () => {
    setError(null);
    try {
      const [s, ex] = await Promise.all([
        apiFetch<RepasseStatus>("/api/organizador/asaas", { cache: "no-store" }),
        apiFetch<{ saldo: Saldo; movimentos: Movimento[] }>("/api/organizador/financeiro/extrato?limite=30", {
          cache: "no-store",
        }),
      ]);
      setStatus(s);
      setSaldo(ex.saldo);
      setMovimentos(ex.movimentos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar repasses.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
          renda_mensal: parseValorMonetarioInput(renda) ?? 0,
          cep: onlyDigits(cep, 8),
          endereco: endereco.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
        }),
      });
      setMsg(r.mensagem);
      setMostrarSubconta(false);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar conta de repasses.");
    } finally {
      setBusy(false);
    }
  }

  async function solicitarSaque(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const valor = parseValorMonetarioInput(saqueValor);
      if (!valor) throw new Error("Informe o valor do saque.");
      const r = await apiFetch<{ mensagem: string }>("/api/organizador/financeiro/saque", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor, pix_chave: pixChave.trim() }),
      });
      setMsg(r.mensagem);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível solicitar saque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Repasses e saques</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Receba vendas na sua conta EventosBR e solicite saques via Pix — tudo pela plataforma.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {saldo ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
            <p className="text-xs text-zinc-500">Saldo disponível</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{fmt(saldo.saldo_disponivel)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Taxa EventosBR ({saldo.rotulo_taxa})</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{fmt(saldo.taxa_plataforma_total)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Líquido acumulado</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">{fmt(saldo.liquido_acumulado)}</p>
          </div>
        </div>
      ) : null}

      {status && !status.repasses_prontos ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">Configure sua conta de repasses</p>
          <p className="mt-1">{status.nota_wallet}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setMostrarSubconta(true)}
          >
            Criar conta de repasses
          </button>
        </div>
      ) : null}

      {mostrarSubconta ? (
        <form onSubmit={criarSubconta} className="mt-6 grid gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-sm font-semibold text-zinc-900">Dados para conta de repasses</h3>
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="CPF ou CNPJ"
            value={formatCpfMask(cpfCnpj)}
            onChange={(e) => setCpfCnpj(onlyDigits(e.target.value, 14))}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Telefone"
            value={telefone}
            onChange={(e) => setTelefone(onlyDigits(e.target.value, 11))}
          />
          <InputValorBrl value={renda} onChange={setRenda} className="rounded-lg" />
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="CEP"
            value={cep}
            onChange={(e) => setCep(onlyDigits(e.target.value, 8))}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Endereço"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Número"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">
              Confirmar
            </button>
            <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setMostrarSubconta(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {status?.repasses_prontos ? (
        <form onSubmit={solicitarSaque} className="mt-6 border-t border-zinc-100 pt-5">
          <h3 className="text-sm font-semibold text-zinc-900">Solicitar saque via Pix</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[9rem]">
              <label className="text-xs text-zinc-600">Valor</label>
              <InputValorBrl value={saqueValor} onChange={setSaqueValor} className="mt-1 rounded-lg" />
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs text-zinc-600">Chave Pix</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={pixChave}
                onChange={(e) => setPixChave(e.target.value)}
                placeholder="E-mail, CPF, telefone ou aleatória"
              />
            </div>
            <button type="submit" disabled={busy} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">
              Solicitar saque
            </button>
          </div>
        </form>
      ) : null}

      {movimentos.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-zinc-900">Extrato recente</h3>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {movimentos.map((m) => (
              <li key={`${m.tipo}-${m.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{m.descricao}</p>
                  <p className="text-xs text-zinc-500">{m.data ? new Date(m.data).toLocaleString("pt-BR") : "—"}</p>
                </div>
                {m.tipo === "venda" ? (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-emerald-800">+ {fmt(m.liquido)}</p>
                    <p className="text-zinc-500">Taxa {fmt(m.taxa_plataforma)}</p>
                  </div>
                ) : (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-zinc-900">− {fmt(m.valor)}</p>
                    <p className="text-zinc-500 capitalize">{m.status}</p>
                    {m.status === "pendente" ? (
                      <button
                        type="button"
                        className="mt-1 text-xs text-red-700 underline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(null);
                          try {
                            await apiFetch(`/api/organizador/financeiro/saque/${m.id}/cancelar`, {
                              method: "POST",
                            });
                            setMsg("Saque cancelado. Saldo liberado.");
                            await carregar();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Não foi possível cancelar.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
