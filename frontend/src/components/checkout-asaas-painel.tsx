"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { mapCheckoutError } from "@/lib/checkout-errors";
import { formatCpfMask, onlyDigits } from "@/lib/cpf";
import {
  AVISO_LEGAL_TAXAS,
  PARCELAMENTO_MINIMO_REAIS,
  calcularTaxaAsaas,
} from "@/lib/taxas-asaas-publicas";
import type { AsaasPixPayload, CriarPagamentoResponse } from "@/lib/types";

function formatBrl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Props = {
  ingressoId: string;
  valorFmt: string;
  valorCentavos: number;
  participanteNome: string;
  participanteEmail: string;
  participanteCpf?: string;
  reservadoAte?: string | null;
  parcelamentoHabilitado?: boolean;
  parcelamentoMax?: number;
  tokenEspera?: string | null;
  onSuccess: () => void;
};

type Metodo = "pix" | "card" | "invoice";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CheckoutAsaasPainel({
  ingressoId,
  valorFmt,
  valorCentavos,
  participanteNome,
  participanteEmail,
  participanteCpf,
  reservadoAte,
  parcelamentoHabilitado = false,
  parcelamentoMax = 2,
  tokenEspera = null,
  onSuccess,
}: Props) {
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<AsaasPixPayload | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  const [cardNome, setCardNome] = useState(participanteNome);
  const [cardNumero, setCardNumero] = useState("");
  const [cardMes, setCardMes] = useState("");
  const [cardAno, setCardAno] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpf, setCardCpf] = useState(participanteCpf ?? "");
  const [cardCep, setCardCep] = useState("");
  const [cardNumeroEnd, setCardNumeroEnd] = useState("");
  const [cardTel, setCardTel] = useState("");

  const valorReais = valorCentavos / 100;
  const parcelamentoAtivo =
    parcelamentoHabilitado && valorCentavos >= PARCELAMENTO_MINIMO_REAIS * 100;
  const taxaParcelamentoEst =
    metodo === "card" && parcelas > 1
      ? calcularTaxaAsaas(valorReais, "cartao_parcelado", parcelas)
      : 0;

  useEffect(() => {
    if (!reservadoAte) return;
    const end = new Date(reservadoAte).getTime();
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) {
        setCountdown("0:00");
        return;
      }
      setCountdown(formatCountdown(left));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [reservadoAte]);

  useEffect(() => {
    if (!pix && !invoiceUrl) return;
    const id = window.setInterval(async () => {
      try {
        const st = await apiFetch<{ pago?: boolean }>(`/api/pagamentos/asaas/status/${ingressoId}`);
        if (st.pago) onSuccess();
      } catch {
        /* polling silencioso */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [pix, invoiceUrl, ingressoId, onSuccess]);

  async function iniciar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        ingresso_id: ingressoId,
        metodo: metodo === "pix" ? "pix" : metodo === "card" ? "card" : "invoice",
      };
      if (tokenEspera?.trim()) {
        body.token_espera = tokenEspera.trim();
      }

      if (metodo === "card") {
        const cpf = onlyDigits(cardCpf, 11);
        const cep = onlyDigits(cardCep, 8);
        const tel = onlyDigits(cardTel, 11);
        if (!cardNome.trim() || cardNumero.replace(/\D/g, "").length < 13) {
          setMsg("Preencha nome e número do cartão.");
          setBusy(false);
          return;
        }
        if (!cardMes || !cardAno || cardCvv.length < 3) {
          setMsg("Validade e CVV são obrigatórios.");
          setBusy(false);
          return;
        }
        if (cpf.length !== 11 || cep.length !== 8) {
          setMsg("CPF e CEP do titular são obrigatórios.");
          setBusy(false);
          return;
        }
        body.credit_card = {
          holderName: cardNome.trim(),
          number: cardNumero.replace(/\D/g, ""),
          expiryMonth: cardMes.padStart(2, "0"),
          expiryYear: cardAno.length === 2 ? `20${cardAno}` : cardAno,
          ccv: cardCvv,
        };
        body.credit_card_holder_info = {
          name: cardNome.trim(),
          email: participanteEmail.trim(),
          cpfCnpj: cpf,
          postalCode: cep,
          addressNumber: cardNumeroEnd.trim() || "S/N",
          phone: tel || undefined,
        };
        if (parcelamentoHabilitado && parcelas > 1) {
          body.parcelas = parcelas;
        }
      }

      const data = await apiFetch<
        CriarPagamentoResponse & { pix?: AsaasPixPayload; invoice_url?: string; ja_pago?: boolean }
      >("/api/pagamentos/asaas/cobranca", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (data.ja_pago) {
        onSuccess();
        return;
      }
      if (data.pix) {
        setPix(data.pix);
        setInvoiceUrl(null);
        return;
      }
      if (data.invoice_url) {
        setInvoiceUrl(data.invoice_url);
        window.open(data.invoice_url, "_blank", "noopener,noreferrer");
        return;
      }
      if (metodo === "card") {
        const st = await apiFetch<{ pago?: boolean }>(`/api/pagamentos/asaas/status/${ingressoId}`);
        if (st.pago) {
          onSuccess();
          return;
        }
        setMsg("Pagamento em processamento. Aguarde a confirmação…");
        return;
      }
      setMsg("Cobrança criada. Aguarde a confirmação ou tente novamente.");
    } catch (err) {
      setMsg(mapCheckoutError(err instanceof Error ? err.message : "Falha ao iniciar pagamento."));
    } finally {
      setBusy(false);
    }
  }

  if (pix?.encoded_image || pix?.copia_cola) {
    return (
      <div className="space-y-4">
        {countdown && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Reserva válida por <strong>{countdown}</strong>
          </p>
        )}
        <p className="text-sm text-gray-600">Pague {valorFmt} via PIX. A confirmação é automática.</p>
        {pix.encoded_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${pix.encoded_image}`}
            alt="QR Code PIX"
            className="mx-auto h-48 w-48 rounded-lg border"
          />
        )}
        {pix.copia_cola && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">PIX copia e cola</p>
            <textarea
              readOnly
              className="w-full rounded border p-2 text-xs"
              rows={3}
              value={pix.copia_cola}
              onFocus={(ev) => ev.target.select()}
            />
          </div>
        )}
        <p className="text-xs text-gray-500">Aguardando confirmação do pagamento…</p>
      </div>
    );
  }

  return (
    <form onSubmit={iniciar} className="space-y-4">
      {countdown && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Seu ingresso está reservado por <strong>{countdown}</strong>
        </p>
      )}
      <p className="text-sm text-gray-700">
        Total: <strong>{valorFmt}</strong> — pagamento seguro via Asaas
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-2 text-sm ${metodo === "pix" ? "border-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setMetodo("pix")}
        >
          PIX
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-2 text-sm ${metodo === "card" ? "border-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setMetodo("card")}
        >
          Cartão
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-2 text-sm ${metodo === "invoice" ? "border-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setMetodo("invoice")}
        >
          Fatura
        </button>
      </div>

      {metodo === "card" && parcelamentoAtivo ? (
        <div>
          <label className="text-xs font-medium text-gray-600">Parcelas</label>
          <select
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value))}
          >
            <option value={1}>À vista</option>
            {[2, 3, 6, 12]
              .filter((n) => n <= parcelamentoMax)
              .map((n) => (
                <option key={n} value={n}>
                  {n}x de {formatBrl(valorReais / n)}
                </option>
              ))}
          </select>
          {parcelas > 1 ? (
            <p className="mt-2 text-xs text-zinc-600">
              Total: <strong>{formatBrl(valorReais)}</strong> — taxa estimada Asaas ({parcelas}x):{" "}
              <strong>{formatBrl(taxaParcelamentoEst)}</strong>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{AVISO_LEGAL_TAXAS}</p>
        </div>
      ) : metodo === "card" && parcelamentoHabilitado && !parcelamentoAtivo ? (
        <p className="text-xs text-amber-800">
          Parcelamento disponível a partir de {formatBrl(PARCELAMENTO_MINIMO_REAIS)}.
        </p>
      ) : null}

      {metodo === "card" ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-xs text-zinc-600">Dados do cartão (processados pelo Asaas; não armazenamos o número).</p>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Nome no cartão"
            value={cardNome}
            onChange={(e) => setCardNome(e.target.value)}
            autoComplete="cc-name"
          />
          <input
            className="w-full rounded border px-3 py-2 text-sm font-mono"
            placeholder="Número do cartão"
            value={cardNumero}
            onChange={(e) => setCardNumero(e.target.value.replace(/[^\d\s]/g, ""))}
            autoComplete="cc-number"
            inputMode="numeric"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="MM"
              maxLength={2}
              value={cardMes}
              onChange={(e) => setCardMes(onlyDigits(e.target.value, 2))}
              autoComplete="cc-exp-month"
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="AAAA"
              maxLength={4}
              value={cardAno}
              onChange={(e) => setCardAno(onlyDigits(e.target.value, 4))}
              autoComplete="cc-exp-year"
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="CVV"
              maxLength={4}
              value={cardCvv}
              onChange={(e) => setCardCvv(onlyDigits(e.target.value, 4))}
              autoComplete="cc-csc"
            />
          </div>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="CPF do titular"
            value={formatCpfMask(cardCpf)}
            onChange={(e) => setCardCpf(onlyDigits(e.target.value, 11))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="CEP"
              value={cardCep}
              onChange={(e) => setCardCep(onlyDigits(e.target.value, 8))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Nº endereço"
              value={cardNumeroEnd}
              onChange={(e) => setCardNumeroEnd(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {metodo === "invoice" && (
        <p className="text-xs text-gray-500">
          Abriremos a fatura Asaas em nova aba (cartão, boleto ou PIX).
        </p>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white disabled:opacity-60"
      >
        {busy
          ? "Processando…"
          : metodo === "pix"
            ? "Gerar PIX"
            : metodo === "card"
              ? "Pagar com cartão"
              : "Abrir pagamento"}
      </button>
      <p className="text-xs text-gray-400">
        Participante: {participanteNome} ({participanteEmail})
        {participanteCpf ? ` · CPF ${participanteCpf}` : ""}
      </p>
    </form>
  );
}
