"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TelefoneInput } from "@/components/telefone-input";
import { apiFetch } from "@/lib/api";
import type { Evento, IngressoLote } from "@/lib/types";

type Props = { eventoId: string };

type FormaPagamento = "dinheiro" | "pix_manual" | "cartao";

type VendaBuscaItem = {
  ingresso_id: string;
  participante_nome: string | null;
  participante_email: string | null;
  participante_telefone: string | null;
  status: string;
  canal_venda: string | null;
  assento: string | null;
  lote_nome: string | null;
};

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix_manual", label: "PIX (manual)" },
  { value: "cartao", label: "Cartão (manual)" },
];

export function PdvPresencialClient({ eventoId }: Props) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loteId, setLoteId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [telefone, setTelefone] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [assento, setAssento] = useState("");
  const [ultimoQrUrl, setUltimoQrUrl] = useState<string | null>(null);
  const [ultimoEmailDestino, setUltimoEmailDestino] = useState<string | null>(null);

  const [buscaQ, setBuscaQ] = useState("");
  const [buscaResultados, setBuscaResultados] = useState<VendaBuscaItem[]>([]);
  const [buscaBusy, setBuscaBusy] = useState(false);
  const [selecionado, setSelecionado] = useState<VendaBuscaItem | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [correcaoMsg, setCorrecaoMsg] = useState<string | null>(null);
  const [correcaoErro, setCorrecaoErro] = useState<string | null>(null);
  const [correcaoBusy, setCorrecaoBusy] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const ev = await apiFetch<Evento>(`/api/eventos/id/${eventoId}`);
      setEvento(ev);
      const lotes = [...(ev.ingresso_lotes ?? [])].sort((a, b) => a.ordem - b.ordem);
      if (!loteId && lotes[0]) setLoteId(lotes[0].id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o evento.");
      setEvento(null);
    }
  }, [eventoId, loteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const lotes = useMemo(
    () => [...(evento?.ingresso_lotes ?? [])].sort((a, b) => a.ordem - b.ordem),
    [evento],
  );

  const loteAtual: IngressoLote | undefined = lotes.find((l) => l.id === loteId) ?? lotes[0];
  const usaAssentos = Boolean(loteAtual?.assentos && loteAtual.assentos.length > 0);
  const assentosDisp = loteAtual?.assentos_disponiveis ?? [];
  const assentosOcc = loteAtual?.assentos_ocupados ?? [];

  function selecionarVenda(item: VendaBuscaItem) {
    setSelecionado(item);
    setEditNome(item.participante_nome ?? "");
    setEditEmail(item.participante_email ?? "");
    setEditTelefone(item.participante_telefone ?? "");
    setCorrecaoMsg(null);
    setCorrecaoErro(null);
  }

  async function buscarVendas() {
    const q = buscaQ.trim();
    if (q.length < 2) {
      setCorrecaoErro("Digite pelo menos 2 caracteres (nome, e-mail, telefone ou CPF).");
      return;
    }
    setCorrecaoErro(null);
    setCorrecaoMsg(null);
    setBuscaBusy(true);
    try {
      const res = await apiFetch<{ resultados: VendaBuscaItem[] }>(
        `/api/eventos/id/${eventoId}/pdv/vendas/buscar?q=${encodeURIComponent(q)}`,
      );
      setBuscaResultados(res.resultados ?? []);
      if (!res.resultados?.length) {
        setCorrecaoErro("Nenhum ingresso encontrado com esse termo.");
        setSelecionado(null);
      }
    } catch (e) {
      setCorrecaoErro(e instanceof Error ? e.message : "Falha na busca.");
      setBuscaResultados([]);
    } finally {
      setBuscaBusy(false);
    }
  }

  async function salvarCorrecao() {
    if (!selecionado) return;
    if (!editNome.trim()) {
      setCorrecaoErro("Informe o nome do participante.");
      return;
    }
    if (!editEmail.trim() || !editEmail.includes("@")) {
      setCorrecaoErro("Informe um e-mail válido.");
      return;
    }
    setCorrecaoBusy(true);
    setCorrecaoErro(null);
    setCorrecaoMsg(null);
    try {
      await apiFetch(`/api/eventos/id/${eventoId}/pdv/vendas/${selecionado.ingresso_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participante_nome: editNome.trim(),
          participante_email: editEmail.trim(),
          participante_telefone: editTelefone.trim() || null,
        }),
      });
      setCorrecaoMsg("Dados atualizados. Peça o comprador conferir o e-mail após reenviar.");
      await buscarVendas();
    } catch (e) {
      setCorrecaoErro(e instanceof Error ? e.message : "Falha ao salvar correção.");
    } finally {
      setCorrecaoBusy(false);
    }
  }

  async function reenviarIngresso() {
    if (!selecionado) return;
    setCorrecaoBusy(true);
    setCorrecaoErro(null);
    setCorrecaoMsg(null);
    try {
      const res = await apiFetch<{ message: string; email_destino: string }>(
        `/api/eventos/id/${eventoId}/pdv/vendas/${selecionado.ingresso_id}/reenviar-email`,
        { method: "POST" },
      );
      setCorrecaoMsg(res.message || `Ingresso enviado para ${res.email_destino}.`);
    } catch (e) {
      setCorrecaoErro(e instanceof Error ? e.message : "Falha ao reenviar ingresso.");
    } finally {
      setCorrecaoBusy(false);
    }
  }

  async function confirmarVenda(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOkMsg(null);
    setUltimoQrUrl(null);
    setUltimoEmailDestino(null);
    if (!loteAtual) {
      setErro("Selecione um lote.");
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome do participante.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErro("Informe um e-mail válido do participante.");
      return;
    }
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      setErro("Os e-mails não coincidem. Confira com o comprador antes de vender.");
      return;
    }
    if (usaAssentos && !assento.trim()) {
      setErro("Escolha um assento disponível.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        lote_id: loteAtual.id,
        participante_nome: nome.trim(),
        participante_email: email.trim(),
        participante_telefone: telefone.trim() || null,
        forma_pagamento: forma,
      };
      if (usaAssentos) body.assento = assento.trim();
      const res = await apiFetch<{
        ok: boolean;
        ingresso_id: string;
        status: string;
        assento?: string | null;
        participante_email?: string;
        email_enviado_sync?: boolean;
        qr_url?: string;
        codigo_checkin?: string;
      }>(`/api/eventos/id/${eventoId}/pdv`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const dest = res.participante_email || email.trim();
      setUltimoEmailDestino(dest);
      setOkMsg(
        `Compra realizada! Ingresso enviado para ${dest}. ${res.email_enviado_sync ? "Peça o comprador conferir agora (incluindo spam)." : "Deve chegar em instantes — peça o comprador conferir agora."}`,
      );
      setUltimoQrUrl(res.qr_url || `/ingresso/qr?c=${res.codigo_checkin}`);
      setNome("");
      setEmail("");
      setEmailConfirm("");
      setTelefone("");
      setAssento("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao registrar venda.");
    } finally {
      setBusy(false);
    }
  }

  if (erro && !evento) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-red-700">{erro}</p>
        <Link href="/organizador/eventos" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          Voltar aos eventos
        </Link>
      </div>
    );
  }

  if (!evento) {
    return <p className="px-4 py-10 text-sm text-zinc-600">Carregando PDV…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Venda presencial</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{evento.nome}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Registra ingresso pago na hora (dinheiro / PIX manual / cartão). Sem cobrança Asaas e sem
        split automático — reconciliação financeira fica a cargo do organizador.
      </p>

      <form onSubmit={(e) => void confirmarVenda(e)} className="mt-6 space-y-4">
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Lote
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={loteAtual?.id ?? ""}
            onChange={(e) => {
              setLoteId(e.target.value);
              setAssento("");
            }}
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome} —{" "}
                {l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {l.quantidade_maxima != null
                  ? ` (${l.vendidos}/${l.quantidade_maxima})`
                  : ` (${l.vendidos} vendidos)`}
              </option>
            ))}
          </select>
        </label>

        {usaAssentos ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
            <p className="font-medium text-zinc-800">Assentos do lote</p>
            <p className="mt-1 text-xs text-zinc-600">
              Vendidos/ocupados:{" "}
              {assentosOcc.length > 0 ? assentosOcc.join(", ") : "nenhum ainda"}
            </p>
            <label className="mt-3 grid gap-1 text-sm font-medium text-zinc-800">
              Assento desta venda
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={assento}
                onChange={(e) => setAssento(e.target.value)}
              >
                <option value="">Selecione</option>
                {assentosDisp.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Nome do participante *
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          E-mail do participante *
          <input
            type="email"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Confirme o e-mail *
          <input
            type="email"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
            required
            maxLength={255}
            placeholder="Repita o e-mail do comprador"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Telefone (opcional)
          <TelefoneInput
            value={telefone}
            onChange={setTelefone}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Forma de pagamento
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaPagamento)}
          >
            {FORMAS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}
        {ultimoEmailDestino ? (
          <p className="text-xs text-zinc-600">
            Não recebeu? Corrija abaixo em &quot;Corrigir venda&quot; antes que o comprador saia.
          </p>
        ) : null}
        {ultimoQrUrl ? (
          <Link
            href={ultimoQrUrl}
            className="inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Abrir carteirinha / QR
          </Link>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="btn-success w-full px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? "Registrando…" : "Confirmar venda presencial"}
        </button>
      </form>

      <section className="mt-10 border-t border-zinc-200 pt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Corrigir venda</h2>
        <p className="mt-1 text-sm text-zinc-600">
          E-mail errado ou comprador não recebeu? Busque por nome, telefone ou e-mail digitado na
          venda (mín. 2 caracteres). Corrija os dados e reenvie o ingresso.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={buscaQ}
            onChange={(e) => setBuscaQ(e.target.value)}
            placeholder="Nome, e-mail, telefone ou CPF"
            maxLength={120}
          />
          <button
            type="button"
            disabled={buscaBusy}
            onClick={() => void buscarVendas()}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            {buscaBusy ? "Buscando…" : "Buscar"}
          </button>
        </div>

        {correcaoErro ? <p className="mt-3 text-sm text-red-700">{correcaoErro}</p> : null}
        {correcaoMsg ? <p className="mt-3 text-sm text-emerald-700">{correcaoMsg}</p> : null}

        {buscaResultados.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {buscaResultados.map((item) => (
              <li key={item.ingresso_id}>
                <button
                  type="button"
                  onClick={() => selecionarVenda(item)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selecionado?.ingresso_id === item.ingresso_id
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="font-medium text-zinc-900">{item.participante_nome}</span>
                  <span className="text-zinc-600"> · {item.participante_email}</span>
                  {item.assento ? <span className="text-zinc-500"> · {item.assento}</span> : null}
                  {item.canal_venda ? (
                    <span className="text-xs text-zinc-400"> · {item.canal_venda}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selecionado ? (
          <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-800">Editar participante</p>
            <label className="grid gap-1 text-sm font-medium text-zinc-800">
              Nome
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-zinc-800">
              E-mail
              <input
                type="email"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                maxLength={255}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-zinc-800">
              Telefone
              <TelefoneInput
                value={editTelefone}
                onChange={setEditTelefone}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={correcaoBusy}
                onClick={() => void salvarCorrecao()}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Salvar correção
              </button>
              <button
                type="button"
                disabled={correcaoBusy}
                onClick={() => void reenviarIngresso()}
                className="btn-success px-3 py-2 text-sm disabled:opacity-60"
              >
                Reenviar ingresso por e-mail
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <Link
        href="/organizador/eventos"
        className="mt-6 inline-block text-sm text-zinc-600 hover:underline"
      >
        ← Voltar aos eventos
      </Link>
    </div>
  );
}
