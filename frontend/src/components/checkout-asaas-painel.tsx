"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { validarDadosCartao } from "@/lib/cartao-validacao";
import { mapCheckoutError } from "@/lib/checkout-errors";
import { formatCpfMask, onlyDigits } from "@/lib/cpf";
import {
  AVISO_LEGAL_TAXAS,
  PARCELAMENTO_MINIMO_REAIS,
  cotacaoCheckout,
  type RepasseParcelamento,
} from "@/lib/taxas-asaas-publicas";
import { formatBrl } from "@/lib/tarifas-plataforma";
import type { AsaasPixPayload, CriarPagamentoResponse } from "@/lib/types";

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
  repasseParcelamento?: RepasseParcelamento;
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
  repasseParcelamento = "comprador",
  tokenEspera = null,
  onSuccess,
}: Props) {
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<AsaasPixPayload | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
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

  const valorBase = valorCentavos / 100;
  const parcelamentoAtivo =
    parcelamentoHabilitado && valorCentavos >= PARCELAMENTO_MINIMO_REAIS * 100;
  const parcelasEfetivas = metodo === "card" && parcelamentoAtivo ? parcelas : 1;

  const cotacao = useMemo(
    () => cotacaoCheckout(valorBase, parcelasEfetivas, repasseParcelamento),
    [valorBase, parcelasEfetivas, repasseParcelamento],
  );
  const totalPagar =
    metodo === "card" && parcelas > 1 ? cotacao.totalPagar : valorBase;

  const opcoesParcelas = useMemo(() => {
    if (!parcelamentoAtivo) return [];
    const max = Math.min(parcelamentoMax, 12);
    const nums = [1, 2, 3, 6, 12].filter((n) => n === 1 || n <= max);
    return nums.map((n) => {
      const c = cotacaoCheckout(valorBase, n, repasseParcelamento);
      return { parcelas: n, cotacao: c };
    });
  }, [parcelamentoAtivo, parcelamentoMax, valorBase, repasseParcelamento]);

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
    if (!pix && !invoiceUrl && !aguardandoConfirmacao) return;
    const id = window.setInterval(async () => {
      try {
        const st = await apiFetch<{ pago?: boolean }>(`/api/pagamentos/asaas/status/${ingressoId}`);
        if (st.pago) onSuccess();
      } catch {
        /* polling */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [pix, invoiceUrl, aguardandoConfirmacao, ingressoId, onSuccess]);

  async function iniciar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        ingresso_id: ingressoId,
        metodo: metodo === "pix" ? "pix" : metodo === "card" ? "card" : "invoice",
      };
      if (tokenEspera?.trim()) body.token_espera = tokenEspera.trim();
      if (metodo === "card" && parcelas > 1) body.parcelas = parcelas;

      if (metodo === "card") {
        const erroCartao = validarDadosCartao({
          nome: cardNome,
          numero: cardNumero,
          mes: cardMes,
          ano: cardAno,
          cvv: cardCvv,
          cpf: cardCpf,
          cep: cardCep,
        });
        if (erroCartao) {
          setMsg(erroCartao);
          setBusy(false);
          return;
        }
        body.credit_card = {
          holderName: cardNome.trim(),
          number: onlyDigits(cardNumero, 19),
          expiryMonth: cardMes.padStart(2, "0"),
          expiryYear: cardAno.length === 2 ? `20${cardAno}` : cardAno,
          ccv: cardCvv,
        };
        body.credit_card_holder_info = {
          name: cardNome.trim(),
          email: participanteEmail.trim(),
          cpfCnpj: onlyDigits(cardCpf, 14),
          postalCode: onlyDigits(cardCep, 8),
          addressNumber: cardNumeroEnd.trim() || "S/N",
          phone: onlyDigits(cardTel, 11),
        };
      }

      const res = await apiFetch<
        CriarPagamentoResponse & { ja_pago?: boolean; pix?: AsaasPixPayload; invoice_url?: string }
      >(
        "/api/pagamentos/asaas/cobranca",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      );
      if (res.ja_pago) {
        onSuccess();
        return;
      }
      if (res.pix) setPix(res.pix);
      if (res.invoice_url) {
        setInvoiceUrl(res.invoice_url);
        window.open(res.invoice_url, "_blank", "noopener,noreferrer");
      }
      if (res.pix || res.invoice_url || metodo === "card") {
        setAguardandoConfirmacao(true);
      }
    } catch (err) {
      setMsg(mapCheckoutError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  if (pix?.copia_cola || pix?.encoded_image) {
    const qrSrc = pix.encoded_image
      ? pix.encoded_image.startsWith("data:")
        ? pix.encoded_image
        : `data:image/png;base64,${pix.encoded_image}`
      : null;
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-zinc-900">Pague com PIX — {formatBrl(valorBase)}</p>
        {countdown ? <p className="text-xs text-amber-800">Reserva expira em {countdown}</p> : null}
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt="QR Code PIX" className="mx-auto h-48 w-48 rounded-lg border bg-white p-2" />
        ) : null}
        {pix.copia_cola ? (
          <>
            <textarea readOnly className="w-full rounded border p-2 text-xs" rows={4} value={pix.copia_cola} />
            <button
              type="button"
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
              onClick={() => void navigator.clipboard.writeText(pix.copia_cola ?? "")}
            >
              Copiar código PIX
            </button>
          </>
        ) : (
          <p className="text-xs text-zinc-600">Escaneie o QR Code no app do seu banco para pagar.</p>
        )}
        <p className="text-xs text-zinc-500">Aguardando confirmação do pagamento…</p>
      </div>
    );
  }

  if (aguardandoConfirmacao) {
    return (
      <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
        <p className="text-sm font-medium text-indigo-950">
          {metodo === "card"
            ? "Processando pagamento no cartão…"
            : metodo === "invoice"
              ? "Aguardando pagamento da fatura…"
              : "Aguardando confirmação do pagamento…"}
        </p>
        {countdown ? <p className="text-xs text-amber-800">Reserva expira em {countdown}</p> : null}
        {invoiceUrl ? (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-medium text-indigo-800 underline"
          >
            Abrir fatura de pagamento
          </a>
        ) : null}
        <p className="text-xs text-indigo-900">
          Não feche esta página. A confirmação pode levar alguns instantes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={iniciar} className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm" data-testid="checkout-taxas">
        <p className="font-medium text-emerald-900">Resumo</p>
        <ul className="mt-2 space-y-1 text-xs text-emerald-950">
          <li className="flex justify-between gap-2">
            <span>Ingresso</span>
            <span>{formatBrl(valorBase)}</span>
          </li>
          {metodo === "card" && parcelas > 1 && cotacao.acrescimoParcelamento > 0 ? (
            <li className="flex justify-between gap-2 font-medium text-amber-900">
              <span>Acréscimo parcelamento ({parcelas}x)</span>
              <span>+ {formatBrl(cotacao.acrescimoParcelamento)}</span>
            </li>
          ) : repasseParcelamento === "organizador" && metodo === "card" && parcelas > 1 ? (
            <li className="text-xs text-zinc-600">
              Sem acréscimo ao comprador — custo absorvido pelo organizador.
            </li>
          ) : null}
          <li className="flex justify-between gap-2 border-t border-emerald-200/80 pt-1 font-semibold text-emerald-900">
            <span>Total a pagar</span>
            <span>{formatBrl(totalPagar)}</span>
          </li>
          {metodo === "card" && parcelas > 1 && cotacao.valorParcela ? (
            <li className="text-emerald-800">
              {parcelas}x de <strong>{formatBrl(cotacao.valorParcela)}</strong>
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-[11px] text-emerald-800/80">{AVISO_LEGAL_TAXAS}</p>
      </div>

      {countdown ? <p className="text-xs text-amber-800">Reserva expira em {countdown}</p> : null}

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
        <fieldset className="space-y-2" data-testid="checkout-parcelas">
          <legend className="text-xs font-medium text-gray-600">Forma de pagamento</legend>
          <ul className="space-y-2">
            {opcoesParcelas.map(({ parcelas: n, cotacao: c }) => {
              const id = `parcelas-${n}`;
              const label =
                n === 1
                  ? `À vista — ${formatBrl(valorBase)}`
                  : `${n}x de ${formatBrl(c.valorParcela ?? 0)} (total ${formatBrl(c.totalPagar)})`;
              return (
                <li key={n}>
                  <label
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      parcelas === n
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="parcelas"
                      className="shrink-0"
                      checked={parcelas === n}
                      onChange={() => setParcelas(n)}
                    />
                    <span className="flex-1">{label}</span>
                    {n > 1 && c.acrescimoParcelamento > 0 ? (
                      <span className="text-xs text-amber-800">+{formatBrl(c.acrescimoParcelamento)}</span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : metodo === "card" && parcelamentoHabilitado && !parcelamentoAtivo ? (
        <p className="text-xs text-amber-800">
          Parcelamento disponível a partir de {formatBrl(PARCELAMENTO_MINIMO_REAIS)}.
        </p>
      ) : null}

      {metodo === "card" ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-xs text-zinc-600">Dados do cartão (processamento seguro pela plataforma).</p>
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
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="AAAA"
              maxLength={4}
              value={cardAno}
              onChange={(e) => setCardAno(onlyDigits(e.target.value, 4))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="CVV"
              maxLength={4}
              value={cardCvv}
              onChange={(e) => setCardCvv(onlyDigits(e.target.value, 4))}
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
        <p className="text-xs text-gray-500">Abriremos a fatura de pagamento em nova aba.</p>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white disabled:opacity-60"
      >
        {busy ? "Processando…" : metodo === "pix" ? `Pagar ${formatBrl(valorBase)} com PIX` : `Pagar ${formatBrl(totalPagar)}`}
      </button>
      <p className="text-xs text-gray-400">
        {valorFmt} · {participanteNome} ({participanteEmail})
      </p>
    </form>
  );
}
