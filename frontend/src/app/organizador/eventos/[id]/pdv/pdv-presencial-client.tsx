"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Evento, IngressoLote } from "@/lib/types";

type Props = { eventoId: string };

type FormaPagamento = "dinheiro" | "pix_manual" | "cartao";

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
  const [telefone, setTelefone] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [assento, setAssento] = useState("");
  const [ultimoQrUrl, setUltimoQrUrl] = useState<string | null>(null);

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

  async function confirmarVenda(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOkMsg(null);
    setUltimoQrUrl(null);
    if (!loteAtual) {
      setErro("Selecione um lote.");
      return;
    }
    if (!nome.trim()) {
      setErro("Informe o nome do participante.");
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
        participante_email: email.trim() || null,
        participante_telefone: telefone.trim() || null,
        forma_pagamento: forma,
      };
      if (usaAssentos) body.assento = assento.trim();
      const res = await apiFetch<{
        ok: boolean;
        ingresso_id: string;
        status: string;
        assento?: string | null;
        qr_url?: string;
        codigo_checkin?: string;
      }>(`/api/eventos/id/${eventoId}/pdv`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setOkMsg(
        `Venda registrada. Ingresso ${res.status}${res.assento ? ` · assento ${res.assento}` : ""}.`,
      );
      setUltimoQrUrl(res.qr_url || `/conta/ingressos/${res.ingresso_id}`);
      setNome("");
      setEmail("");
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
          E-mail (opcional — envia carteirinha se preenchido)
          <input
            type="email"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          Telefone (opcional)
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            maxLength={20}
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

      <Link
        href="/organizador/eventos"
        className="mt-6 inline-block text-sm text-zinc-600 hover:underline"
      >
        ← Voltar aos eventos
      </Link>
    </div>
  );
}
