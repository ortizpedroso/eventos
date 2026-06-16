"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { mapCheckoutError } from "@/lib/checkout-errors";
import type { AsaasPixPayload, CriarPagamentoResponse } from "@/lib/types";

type Props = {
  ingressoId: string;
  valorFmt: string;
  valorCentavos: number;
  participanteNome: string;
  participanteEmail: string;
  participanteCpf?: string;
  reservadoAte?: string | null;
  onSuccess: () => void;
};

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CheckoutAsaasPainel({
  ingressoId,
  valorFmt,
  participanteNome,
  participanteEmail,
  participanteCpf,
  reservadoAte,
  onSuccess,
}: Props) {
  const [metodo, setMetodo] = useState<"pix" | "invoice">("pix");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<AsaasPixPayload | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

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
      const data = await apiFetch<CriarPagamentoResponse & { pix?: AsaasPixPayload; invoice_url?: string; ja_pago?: boolean }>(
        "/api/pagamentos/asaas/cobranca",
        {
          method: "POST",
          body: JSON.stringify({
            ingresso_id: ingressoId,
            metodo: metodo === "pix" ? "pix" : "invoice",
          }),
        },
      );
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
              onFocus={(e) => e.target.select()}
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
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${metodo === "pix" ? "border-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setMetodo("pix")}
        >
          PIX
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${metodo === "invoice" ? "border-indigo-600 bg-indigo-50" : ""}`}
          onClick={() => setMetodo("invoice")}
        >
          Cartão / boleto
        </button>
      </div>
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
        {busy ? "Gerando…" : metodo === "pix" ? "Gerar PIX" : "Abrir pagamento"}
      </button>
      <p className="text-xs text-gray-400">
        Participante: {participanteNome} ({participanteEmail})
        {participanteCpf ? ` · CPF ${participanteCpf}` : ""}
      </p>
    </form>
  );
}
