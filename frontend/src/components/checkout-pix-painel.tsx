"use client";

import { useEffect, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";

export type PixDisplayData = {
  imageUrl: string;
  expiresAt: number;
  copyPaste?: string;
  hostedInstructionsUrl?: string;
};

type NextActionPixQr = {
  type: "pix_display_qr_code";
  pix_display_qr_code?: {
    data?: string | null;
    image_url_png?: string | null;
    image_url_svg?: string | null;
    expires_at?: number | null;
    hosted_instructions_url?: string | null;
  };
};

export function pixFromPaymentIntent(
  paymentIntent: import("@stripe/stripe-js").PaymentIntent,
): PixDisplayData | null {
  const na = paymentIntent.next_action as NextActionPixQr | null;
  if (!na || na.type !== "pix_display_qr_code") return null;
  const pix = na.pix_display_qr_code;
  if (!pix) return null;
  const imageUrl = pix.image_url_png || pix.image_url_svg || "";
  const copyPaste = pix.data?.trim() || "";
  const hostedInstructionsUrl = pix.hosted_instructions_url ?? undefined;
  if (!imageUrl && !copyPaste && !hostedInstructionsUrl) return null;
  return {
    imageUrl: imageUrl || "",
    expiresAt: pix.expires_at ?? 0,
    copyPaste: copyPaste || undefined,
    hostedInstructionsUrl,
  };
}

/** Busca QR PIX no PaymentIntent retornado ou via retrieve (dados completos). */
export async function carregarPixDoIntent(
  stripe: Stripe,
  clientSecret: string,
  paymentIntent?: import("@stripe/stripe-js").PaymentIntent | null,
): Promise<PixDisplayData | null> {
  const direto = paymentIntent ? pixFromPaymentIntent(paymentIntent) : null;
  if (direto?.imageUrl || direto?.copyPaste) return direto;

  const { paymentIntent: atualizado } = await stripe.retrievePaymentIntent(clientSecret);
  if (!atualizado) return null;
  return pixFromPaymentIntent(atualizado);
}

function formatTempoRestante(segundos: number): string {
  if (segundos <= 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Props = {
  stripe: Stripe;
  clientSecret: string;
  pix: PixDisplayData;
  valorFmt: string;
  onPago: () => void;
  onExpirado: () => void;
};

/** QR PIX do Stripe + contagem regressiva até expiração. */
export function CheckoutPixPainel({
  stripe,
  clientSecret,
  pix,
  valorFmt,
  onPago,
  onExpirado,
}: Props) {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  useEffect(() => {
    if (!pix.expiresAt) return;
    const tick = () => {
      const rest = Math.max(0, Math.floor(pix.expiresAt - Date.now() / 1000));
      setSegundosRestantes(rest);
      if (rest <= 0) onExpirado();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pix.expiresAt, onExpirado]);

  useEffect(() => {
    let cancelled = false;
    const poll = window.setInterval(() => {
      void (async () => {
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        if (cancelled || !paymentIntent) return;
        if (paymentIntent.status === "succeeded") {
          window.clearInterval(poll);
          onPago();
        } else if (paymentIntent.status === "canceled") {
          window.clearInterval(poll);
          onExpirado();
        }
      })();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [stripe, clientSecret, onPago, onExpirado]);

  const urgente = segundosRestantes !== null && segundosRestantes < 120;

  return (
    <section className="space-y-4 rounded-lg border border-sky-200 bg-sky-50/80 p-4" aria-label="Pagamento PIX">
      <div>
        <p className="text-sm font-semibold text-sky-950">Pague com PIX</p>
        <p className="mt-1 text-xs text-sky-900/90">
          Valor: <strong>{valorFmt}</strong> — escaneie o QR no app do banco.
        </p>
      </div>

      {segundosRestantes !== null ? (
        <div
          className={`rounded-md px-3 py-2 text-center ${urgente ? "bg-amber-100 text-amber-950" : "bg-white text-sky-950"}`}
          role="timer"
          aria-live="polite"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide">Expira em</p>
          <p className="text-2xl font-bold tabular-nums">{formatTempoRestante(segundosRestantes)}</p>
          {urgente ? (
            <p className="mt-1 text-xs">Conclua o pagamento antes que o código expire.</p>
          ) : null}
        </div>
      ) : null}

      {pix.imageUrl ? (
        <div className="flex justify-center rounded-lg border border-sky-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pix.imageUrl} alt="QR Code PIX para pagamento" width={220} height={220} className="mx-auto" />
        </div>
      ) : null}

      {!pix.imageUrl && pix.hostedInstructionsUrl ? (
        <p className="text-center">
          <a
            href={pix.hostedInstructionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block text-sm text-white"
          >
            Abrir QR Code PIX
          </a>
        </p>
      ) : null}

      {pix.copyPaste ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-sky-950">Pix copia e cola</p>
          <textarea
            readOnly
            rows={3}
            value={pix.copyPaste}
            className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-800"
            aria-label="Código Pix copia e cola"
          />
          <button
            type="button"
            className="btn-outline w-full text-sm"
            onClick={() => void navigator.clipboard.writeText(pix.copyPaste ?? "")}
          >
            Copiar código Pix
          </button>
        </div>
      ) : null}

      {pix.hostedInstructionsUrl ? (
        <p className="text-center text-xs text-sky-900">
          <a
            href={pix.hostedInstructionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Ver instruções alternativas
          </a>
        </p>
      ) : null}

      <p className="text-center text-xs text-zinc-600">
        Após pagar, a confirmação costuma levar alguns segundos. Esta página atualiza automaticamente.
      </p>
    </section>
  );
}
