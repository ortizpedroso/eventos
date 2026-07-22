"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { InputValorBrl } from "@/components/input-valor-brl";
import { apiFetch } from "@/lib/api";
import { formatCepMask } from "@/lib/cep";
import { formatCpfCnpjMask, formatCpfMask, onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";
import { moedaBrlFromNumber } from "@/lib/moeda-brl";
import { parseValorMonetarioInput } from "@/lib/tarifas-plataforma";

type RepasseStatus = {
  asaas_ativo: boolean;
  payments_disabled: boolean;
  wallet_configurado: boolean;
  tem_conta_recebimento: boolean;
  repasses_prontos: boolean;
  repasse_status?: string | null;
  repasse_status_rotulo?: string;
  repasse_aprovado?: boolean;
  pode_reenviar_conta?: boolean;
  pode_publicar_eventos_pagos?: boolean;
  eventos_sem_wallet: number;
  nota_wallet: string | null;
  anticipacao?: { credit_card_automatic_enabled?: boolean | null };
  onboarding_mode?: string;
  permite_vinculo_wallet?: boolean;
  permite_conta_recebimento?: boolean;
  wallet_id?: string | null;
};

type Saldo = {
  plano_tarifa: string;
  rotulo_taxa: string;
  receita_bruta: number;
  taxa_plataforma_total: number;
  liquido_acumulado: number;
  total_repassado_split?: number;
  saldo_em_carencia?: number;
  saldo_liberado_bruto?: number;
  saques_reservados: number;
  saques_pagos_total?: number;
  saldo_disponivel: number;
  saldo_disponivel_saque?: number;
  carencia_horas?: number;
  prazo_transferencia_horas?: number;
  proxima_liberacao_em?: string | null;
  proxima_liberacao_valor?: number;
  saque_habilitado?: boolean;
  nota_saque?: string | null;
  ingressos_pagos: number;
  saldo_asaas?: { disponivel?: boolean; balance?: number; motivo?: string };
};

type Conciliacao = {
  ledger: {
    saldo_esperado_asaas?: number;
    saldo_disponivel_saque?: number;
  };
  asaas: { disponivel?: boolean; balance?: number };
  diferenca?: number | null;
  diferenca_disponivel?: number | null;
  alerta?: string | null;
  nota?: string;
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
      disponivel_saque?: boolean;
      disponivel_saque_em?: string | null;
      descricao: string;
    }
  | {
      tipo: "estorno";
      id: string;
      data: string | null;
      valor: number;
      evento_nome: string;
      descricao: string;
    }
  | {
      tipo: "saque";
      id: string;
      data: string | null;
      valor: number;
      status: string;
      pix_chave: string;
      previsao_liquidacao_em?: string | null;
      processado_em?: string | null;
      observacao?: string | null;
      descricao: string;
    };

type GrupoVendas = {
  chave: string;
  rotulo: string;
  evento_id?: string | null;
  evento_nome?: string | null;
  ingressos: number;
  receita_bruta: number;
  taxa_plataforma: number;
  liquido: number;
};

type Agrupamento = "dia" | "semana" | "mes" | "ano" | "evento";

const AGRUPAMENTOS: { id: Agrupamento; rotulo: string }[] = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano" },
  { id: "evento", rotulo: "Evento" },
];

const PIX_TIPOS = [
  { id: "EVP", rotulo: "Chave aleatória" },
  { id: "EMAIL", rotulo: "E-mail" },
  { id: "CPF", rotulo: "CPF" },
  { id: "CNPJ", rotulo: "CNPJ" },
  { id: "PHONE", rotulo: "Telefone" },
];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function rotuloStatusSaque(status: string) {
  const map: Record<string, string> = {
    pendente: "Pendente",
    processando: "Em processamento",
    pago: "Concluído",
    cancelado: "Cancelado",
    rejeitado: "Rejeitado",
  };
  return map[status] || status;
}

export function OrganizadorRepassesPainel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<RepasseStatus | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [gruposVendas, setGruposVendas] = useState<GrupoVendas[]>([]);
  const [conciliacao, setConciliacao] = useState<Conciliacao | null>(null);
  const [anticipacao, setAnticipacao] = useState<boolean | null>(null);
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("mes");
  const [extratoOffset, setExtratoOffset] = useState(0);
  const [extratoTotal, setExtratoTotal] = useState(0);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mostrarFormContaRecebimento, setMostrarFormContaRecebimento] = useState(false);
  const [mostrarVinculo, setMostrarVinculo] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [apiKeyOrganizador, setApiKeyOrganizador] = useState("");
  const [walletPreview, setWalletPreview] = useState<{
    wallet_id: string;
    account_name?: string | null;
    account_email?: string | null;
  } | null>(null);
  const [buscandoWallet, setBuscandoWallet] = useState(false);
  const [modoReenvio, setModoReenvio] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [renda, setRenda] = useState(() => moedaBrlFromNumber(5000));
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [companyType, setCompanyType] = useState("INDIVIDUAL");
  const [complemento, setComplemento] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [saqueValor, setSaqueValor] = useState(() => moedaBrlFromNumber(100));
  const [pixChave, setPixChave] = useState("");
  const [pixTipo, setPixTipo] = useState("EVP");

  const carregarVendas = useCallback(async (agr: Agrupamento) => {
    try {
      const [v, c] = await Promise.all([
        apiFetch<{ grupos: GrupoVendas[] }>(`/api/organizador/financeiro/vendas?agrupamento=${agr}`, {
          cache: "no-store",
        }),
        apiFetch<Conciliacao>("/api/organizador/financeiro/conciliacao", { cache: "no-store" }),
      ]);
      setGruposVendas(v.grupos);
      setConciliacao(c);
    } catch {
      setGruposVendas([]);
    }
  }, []);

  const carregar = useCallback(
    async (offset = 0, append = false) => {
      setError(null);
      try {
        const [s, ex] = await Promise.all([
          apiFetch<RepasseStatus>("/api/organizador/asaas", { cache: "no-store" }),
          apiFetch<{ saldo: Saldo; movimentos: Movimento[]; total_movimentos?: number }>(
            `/api/organizador/financeiro/extrato?limite=30&offset=${offset}`,
            { cache: "no-store" },
          ),
        ]);
      setStatus(s);
      setSaldo(ex.saldo);
      setAnticipacao(s.anticipacao?.credit_card_automatic_enabled ?? null);
        setExtratoOffset(offset + ex.movimentos.length);
        setExtratoTotal(ex.total_movimentos ?? ex.movimentos.length);
        setMovimentos((prev) => (append ? [...prev, ...ex.movimentos] : ex.movimentos));
        if (!append) {
          const disp = ex.saldo.saldo_disponivel_saque ?? ex.saldo.saldo_disponivel;
          if (disp > 0) setSaqueValor(moedaBrlFromNumber(Math.min(disp, 100)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar o financeiro.");
      }
    },
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void carregarVendas(agrupamento);
  }, [agrupamento, carregarVendas]);

  const podeReenviarConta = Boolean(status?.pode_reenviar_conta);
  const permiteContaRecebimento = Boolean(status?.permite_conta_recebimento);
  const temContaRecebimento = Boolean(status?.tem_conta_recebimento);

  useEffect(() => {
    if (searchParams.get("reenviar") === "1" || podeReenviarConta) {
      setModoReenvio(Boolean(podeReenviarConta));
      setMostrarFormContaRecebimento(true);
    }
  }, [searchParams, podeReenviarConta]);

  async function buscarWalletPelaApiKey() {
    const key = apiKeyOrganizador.trim();
    if (!key) {
      setError("Informe a chave de acesso antes de buscar o ID da conta.");
      return;
    }
    setBuscandoWallet(true);
    setMsg(null);
    setError(null);
    setWalletPreview(null);
    try {
      const r = await apiFetch<{
        wallet_id: string;
        account_name?: string | null;
        account_email?: string | null;
      }>("/api/organizador/asaas/wallet/consultar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      setWalletId(r.wallet_id);
      setWalletPreview(r);
      setMsg(
        r.account_name
          ? `Conta encontrada: ${r.account_name}. Confira o ID e confirme o vínculo.`
          : "ID da conta encontrado. Confira e confirme o vínculo.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar a conta.");
    } finally {
      setBuscandoWallet(false);
    }
  }

  async function vincularConta(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{ mensagem: string }>("/api/organizador/asaas/wallet", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet_id: walletId.trim(),
          sincronizar_eventos: true,
          api_key: apiKeyOrganizador.trim() || undefined,
        }),
      });
      setMsg(r.mensagem);
      setMostrarVinculo(false);
      setWalletPreview(null);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível vincular a conta de recebimento.");
    } finally {
      setBusy(false);
    }
  }

  async function buscarCep(cepVal: string) {
    if (cepVal.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepVal}/json/`);
      const d = await r.json() as {
        erro?: boolean;
        logradouro?: string;
        complemento?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!d.erro) {
        setEndereco(d.logradouro ?? "");
        setBairro(d.bairro ?? "");
        setCidade(d.localidade ?? "");
        setEstado(d.uf ?? "");
        if (d.complemento) setComplemento(d.complemento);
      }
    } catch { /* ignore */ } finally {
      setBuscandoCep(false);
    }
  }

  async function criarContaRecebimento(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const endpoint = modoReenvio
      ? "/api/organizador/asaas/conta-recebimento/reenviar"
      : "/api/organizador/asaas/conta-recebimento";
    try {
      const r = await apiFetch<{
        mensagem: string;
        redirecionar_acompanhamento?: boolean;
      }>(endpoint, {
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
          complemento: complemento.trim() || undefined,
          cidade: cidade.trim() || undefined,
          estado: estado.trim() || undefined,
          company_type: onlyDigits(cpfCnpj, 14).length === 14 ? companyType : "INDIVIDUAL",
          data_nascimento:
            onlyDigits(cpfCnpj, 14).length === 11 ? dataNascimento.trim() || undefined : undefined,
        }),
      });
      setMsg(r.mensagem);
      setMostrarFormContaRecebimento(false);
      setModoReenvio(false);
      if (r.redirecionar_acompanhamento) {
        router.push("/organizador/financeiro/conta-repasse");
        return;
      }
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
        body: JSON.stringify({ valor, pix_chave: pixChave.trim(), pix_tipo: pixTipo }),
      });
      setMsg(r.mensagem);
      await carregar();
      await carregarVendas(agrupamento);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível solicitar transferência.");
    } finally {
      setBusy(false);
    }
  }

  const disponivel = saldo?.saldo_disponivel_saque ?? saldo?.saldo_disponivel ?? 0;
  const carenciaH = saldo?.carencia_horas ?? 48;
  const prazoH = saldo?.prazo_transferencia_horas ?? 48;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Financeiro e repasses</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Tudo em um só lugar: acompanhe vendas, saldo e solicite transferências para sua conta Pix — sem precisar
        acessar outro sistema.
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
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs text-emerald-800">Disponível para saque</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{fmt(disponivel)}</p>
              <p className="mt-1 text-[11px] text-emerald-800">
                Liberado {carenciaH}h após confirmação do pagamento
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs text-amber-900">Em carência</p>
              <p className="mt-1 text-xl font-bold text-amber-950">{fmt(saldo.saldo_em_carencia ?? 0)}</p>
              {saldo.proxima_liberacao_em ? (
                <p className="mt-1 text-[11px] text-amber-900">
                  Próxima liberação: {fmtData(saldo.proxima_liberacao_em)}
                  {saldo.proxima_liberacao_valor ? ` (${fmt(saldo.proxima_liberacao_valor)})` : ""}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-900">Aguardando novas vendas confirmadas</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <p className="text-xs text-zinc-500">Total líquido acumulado</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">
                {fmt(saldo.total_repassado_split ?? saldo.liquido_acumulado)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{saldo.ingressos_pagos} ingressos pagos</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <p className="text-xs text-zinc-500">Saques realizados</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{fmt(saldo.saques_pagos_total ?? 0)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Reservado: {fmt(saldo.saques_reservados)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-900">Como funciona o saldo</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5">
                <li>Cada venda confirmada entra no seu saldo líquido (após taxa EventosBR).</li>
                <li>
                  O valor fica disponível para saque <strong>{carenciaH} horas</strong> após a confirmação do
                  pagamento.
                </li>
                <li>
                  Ao solicitar transferência Pix, a efetivação ocorre em até <strong>{prazoH} horas</strong>.
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
              <p className="text-xs text-zinc-500">Taxa EventosBR ({saldo.rotulo_taxa})</p>
              <p className="text-lg font-semibold text-zinc-900">{fmt(saldo.taxa_plataforma_total)}</p>
              <p className="mt-2 text-xs text-zinc-500">Receita bruta: {fmt(saldo.receita_bruta)}</p>
            </div>
          </div>
        </>
      ) : null}

      {saldo?.nota_saque ? (
        <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          {saldo.nota_saque}
        </p>
      ) : null}

      {saldo?.saldo_asaas?.disponivel && saldo.saldo_asaas.balance != null ? (
        <p className="mt-3 text-xs text-zinc-600">
          Saldo disponível: <strong>{fmt(saldo.saldo_asaas.balance)}</strong>
        </p>
      ) : null}

      {conciliacao?.alerta ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          {conciliacao.alerta}
          {conciliacao.diferenca != null ? (
            <> Diferença: {fmt(conciliacao.diferenca)}.</>
          ) : null}
        </p>
      ) : null}

      {status?.repasse_aprovado && anticipacao != null ? (
        <div className="mt-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm">
          <p className="font-medium text-zinc-900">Antecipação automática de cartão</p>
          <p className="mt-1 text-xs text-zinc-600">
            {anticipacao
              ? "Ativa — vendas no cartão podem ser antecipadas automaticamente pela conta de repasses."
              : "Desativada — recebimentos de cartão seguem o prazo padrão de liquidação."}
          </p>
        </div>
      ) : null}

      {status && !status.repasses_prontos ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">Configure sua conta de repasses</p>
          <p className="mt-1">
            {status.nota_wallet ??
              "Configure sua conta de recebimento para publicar eventos pagos e receber automaticamente."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {status.permite_vinculo_wallet === true ? (
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setMostrarVinculo(true)}
              >
                Vincular conta existente
              </button>
            ) : null}
            {permiteContaRecebimento ? (
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setMostrarFormContaRecebimento(true)}
              >
                Criar conta de recebimento
              </button>
            ) : null}
            {temContaRecebimento && !status.repasse_aprovado ? (
              <Link
                href="/organizador/financeiro/conta-repasse"
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950"
              >
                Acompanhar aprovação
              </Link>
            ) : null}
            {podeReenviarConta ? (
              <button
                type="button"
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900"
                onClick={() => {
                  setModoReenvio(true);
                  setMostrarFormContaRecebimento(true);
                }}
              >
                Reenviar dados
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {status?.repasse_aprovado ? (
        <p className="mt-4 text-sm text-emerald-800">
          Conta de recebimento ativa — vendas e repasses automáticos.{" "}
          <Link href="/organizador/financeiro/conta-repasse" className="font-medium underline">
            Ver detalhes da conta
          </Link>
        </p>
      ) : null}

      {mostrarVinculo ? (
        <form onSubmit={vincularConta} className="mt-6 grid gap-3 border-t border-zinc-100 pt-5">
          <h3 className="text-sm font-semibold text-zinc-900">Vincular conta de recebimento</h3>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Use a conta de recebimento do <strong>organizador</strong>, não a conta da plataforma
            EventosBR. Cada organizador precisa da própria conta para receber repasses via split.
          </p>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-zinc-600">
              Chave de acesso (recomendado — busca o ID automaticamente)
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                type="password"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-sm"
                placeholder="Chave de acesso..."
                value={apiKeyOrganizador}
                onChange={(e) => {
                  setApiKeyOrganizador(e.target.value);
                  setWalletPreview(null);
                }}
              />
              <button
                type="button"
                disabled={busy || buscandoWallet}
                className="rounded-lg border border-emerald-700 bg-white px-3 py-2 text-sm font-medium text-emerald-900"
                onClick={() => void buscarWalletPelaApiKey()}
              >
                {buscandoWallet ? "Buscando…" : "Buscar ID"}
              </button>
            </div>
          </label>
          {walletPreview ? (
            <p className="text-xs text-emerald-800">
              {walletPreview.account_name || walletPreview.account_email || "Conta"} · ID{" "}
              <span className="font-mono">{walletPreview.wallet_id}</span>
            </p>
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-zinc-600">ID da conta de recebimento (UUID)</span>
            <input
              className="rounded-lg border px-3 py-2 font-mono text-sm"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value.trim())}
              required
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">
              Confirmar vínculo
            </button>
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={() => {
                setMostrarVinculo(false);
                setWalletPreview(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {mostrarFormContaRecebimento && permiteContaRecebimento ? (
        <form onSubmit={criarContaRecebimento} className="mt-6 grid gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-sm font-semibold text-zinc-900">
            {modoReenvio ? "Reenviar dados da conta de repasses" : "Dados para conta de repasses"}
          </h3>
          {modoReenvio ? (
            <p className="sm:col-span-2 text-xs text-red-800">
              Sua conta anterior foi reprovada. Revise os dados e envie novamente para análise.
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">CPF ou CNPJ <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={formatCpfCnpjMask(cpfCnpj)}
              onChange={(e) => setCpfCnpj(onlyDigits(e.target.value, 14))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Telefone (WhatsApp) <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="(11) 9 0000-0000"
              inputMode="tel"
              value={formatTelefoneBrMask(telefone)}
              onChange={(e) => setTelefone(onlyDigits(e.target.value, 11))}
            />
          </label>
          {onlyDigits(cpfCnpj, 14).length === 11 ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Data de nascimento <span className="text-red-500">*</span></span>
              <input
                type="date"
                required
                className="rounded-lg border px-3 py-2 text-sm"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Tipo de empresa <span className="text-red-500">*</span></span>
              <select
                required
                className="rounded-lg border bg-white px-3 py-2 text-sm"
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
              >
                <option value="MEI">MEI — Microempreendedor Individual</option>
                <option value="INDIVIDUAL">Autônomo / Profissional Liberal</option>
                <option value="INDIVIDUAL_ENTERPRISE">Empresa Individual (EI)</option>
                <option value="LIMITED">LTDA / S.A.</option>
                <option value="ASSOCIATION">Associação / ONG</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              {onlyDigits(cpfCnpj, 14).length === 14 ? "Faturamento mensal estimado" : "Renda mensal"}{" "}
              <span className="text-red-500">*</span>
            </span>
            <InputValorBrl value={renda} onChange={setRenda} className="rounded-lg" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">CEP <span className="text-red-500">*</span></span>
            <div className="relative">
              <input
                required
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="00000-000"
                inputMode="numeric"
                value={formatCepMask(cep)}
                onChange={(e) => {
                  const v = onlyDigits(e.target.value, 8);
                  setCep(v);
                  void buscarCep(v);
                }}
              />
              {buscandoCep ? (
                <span className="absolute right-3 top-2.5 text-xs text-zinc-400">buscando...</span>
              ) : null}
            </div>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-500">Endereço <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="Rua, Av., Alameda..."
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Número <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="123"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Complemento</span>
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="Apto, sala, bloco... (opcional)"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-500">Bairro <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Cidade <span className="text-red-500">*</span></span>
            <input
              required
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="São Paulo"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Estado (UF) <span className="text-red-500">*</span></span>
            <input
              required
              maxLength={2}
              className="rounded-lg border px-3 py-2 text-sm uppercase"
              placeholder="SP"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
            />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-60">
              {busy ? "Enviando..." : modoReenvio ? "Reenviar dados" : "Criar conta de repasses"}
            </button>
            <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setMostrarFormContaRecebimento(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {gruposVendas.length > 0 ? (
        <div className="mt-8 border-t border-zinc-100 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">Vendas por período</h3>
            <div className="flex flex-wrap gap-1">
              {AGRUPAMENTOS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    agrupamento === a.id
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                  onClick={() => setAgrupamento(a.id)}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">
                    {agrupamento === "evento" ? "Evento" : "Período"}
                  </th>
                  <th className="px-4 py-2 font-medium">Ingressos</th>
                  <th className="px-4 py-2 font-medium">Bruto</th>
                  <th className="px-4 py-2 font-medium">Taxa</th>
                  <th className="px-4 py-2 font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {gruposVendas.map((g) => (
                  <tr key={g.chave}>
                    <td className="px-4 py-2 font-medium text-zinc-900">{g.rotulo}</td>
                    <td className="px-4 py-2 text-zinc-700">{g.ingressos}</td>
                    <td className="px-4 py-2 text-zinc-700">{fmt(g.receita_bruta)}</td>
                    <td className="px-4 py-2 text-zinc-500">{fmt(g.taxa_plataforma)}</td>
                    <td className="px-4 py-2 font-medium text-emerald-800">{fmt(g.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {status?.repasses_prontos && saldo?.saque_habilitado ? (
        <form onSubmit={solicitarSaque} className="mt-8 border-t border-zinc-100 pt-6">
          <h3 className="text-sm font-semibold text-zinc-900">Solicitar transferência via Pix</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Disponível agora: <strong>{fmt(disponivel)}</strong>. Efetivação em até {prazoH}h após a solicitação.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[9rem]">
              <label className="text-xs text-zinc-600">Valor</label>
              <InputValorBrl value={saqueValor} onChange={setSaqueValor} className="mt-1 rounded-lg" />
            </div>
            <div className="min-w-[8rem]">
              <label className="text-xs text-zinc-600">Tipo da chave</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={pixTipo}
                onChange={(e) => setPixTipo(e.target.value)}
              >
                {PIX_TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs text-zinc-600">Chave Pix</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={pixChave}
                onChange={(e) => setPixChave(e.target.value)}
                placeholder="Informe a chave de destino"
              />
            </div>
            <button
              type="submit"
              disabled={busy || disponivel < 1}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Solicitar transferência
            </button>
          </div>
        </form>
      ) : null}

      {movimentos.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-zinc-900">Extrato</h3>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {movimentos.map((m) => (
              <li key={`${m.tipo}-${m.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{m.descricao}</p>
                  <p className="text-xs text-zinc-500">{fmtData(m.data)}</p>
                  {m.tipo === "venda" && m.disponivel_saque_em ? (
                    <p className="text-[11px] text-zinc-500">
                      {m.disponivel_saque
                        ? "Disponível para saque"
                        : `Disponível em ${fmtData(m.disponivel_saque_em)}`}
                    </p>
                  ) : null}
                  {m.tipo === "saque" && m.previsao_liquidacao_em && m.status === "processando" ? (
                    <p className="text-[11px] text-zinc-500">
                      Previsão: {fmtData(m.previsao_liquidacao_em)}
                    </p>
                  ) : null}
                  {m.tipo === "saque" && m.observacao ? (
                    <p className="text-[11px] text-red-700">{m.observacao}</p>
                  ) : null}
                </div>
                {m.tipo === "venda" ? (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-emerald-800">+ {fmt(m.liquido)}</p>
                    <p className="text-zinc-500">Taxa {fmt(m.taxa_plataforma)}</p>
                  </div>
                ) : m.tipo === "estorno" ? (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-red-800">− {fmt(m.valor)}</p>
                    <p className="text-zinc-500">Reembolso / estorno</p>
                  </div>
                ) : (
                  <div className="text-right text-xs">
                    <p className="font-semibold text-zinc-900">− {fmt(m.valor)}</p>
                    <p className="text-zinc-500">{rotuloStatusSaque(m.status)}</p>
                    {m.status === "pago" ? (
                      <button
                        type="button"
                        className="mt-1 text-xs text-emerald-800 underline"
                        onClick={async () => {
                          try {
                            const c = await apiFetch<Record<string, unknown>>(
                              `/api/organizador/financeiro/saque/${m.id}/comprovante`,
                            );
                            setMsg(
                              `Comprovante: ${String(c.titulo || "Transferência")} — ${fmt(Number(c.valor || 0))} — status ${String(c.status)}`,
                            );
                          } catch {
                            setError("Não foi possível obter o comprovante.");
                          }
                        }}
                      >
                        Ver comprovante
                      </button>
                    ) : null}
                    {m.status === "pendente" || m.status === "processando" ? (
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
          {extratoOffset < extratoTotal ? (
            <button
              type="button"
              disabled={carregandoMais}
              className="mt-3 w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              onClick={async () => {
                setCarregandoMais(true);
                try {
                  await carregar(extratoOffset, true);
                } finally {
                  setCarregandoMais(false);
                }
              }}
            >
              {carregandoMais ? "Carregando…" : "Carregar mais movimentos"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
