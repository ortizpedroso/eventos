"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getStripe } from "@/lib/stripe-client";
import type { CriarPagamentoResponse } from "@/lib/types";

type Props = {
  eventoId: string;
  eventoNome: string;
  /** Preço do ingresso em reais (definido na criação do evento) */
  precoIngresso: number;
};

function ConfirmForm({ ingressoId }: { ingressoId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMsg(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/conta/pagamentos`,
      },
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      setMsg(error.message ?? "Falha no pagamento");
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      router.push(`/conta/pagamentos?ok=1&ingresso=${ingressoId}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {msg ? (
        <p className="text-sm text-red-600" role="alert">
          {msg}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="btn-success w-full"
      >
        {busy ? "Processando…" : "Pagar"}
      </button>
    </form>
  );
}

export function ComprarIngresso({ eventoId, eventoNome, precoIngresso }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ingressoId, setIngressoId] = useState<string | null>(null);
  const [pagamentoModoTeste, setPagamentoModoTeste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [mesmoPagador, setMesmoPagador] = useState(true);
  const [participanteNome, setParticipanteNome] = useState("");
  const [participanteEmail, setParticipanteEmail] = useState("");

  const stripePromise = useMemo(() => getStripe(), []);

  async function criarIntent() {
    setError(null);
    const v = precoIngresso;
    if (!Number.isFinite(v) || v < 0.5) {
      setError("Preço do ingresso inválido para pagamento (mínimo R$ 0,50).");
      return;
    }
    const valor_centavos = Math.round(v * 100);
    if (valor_centavos < 50) {
      setError("Valor muito baixo");
      return;
    }

    if (!mesmoPagador) {
      const n = participanteNome.trim();
      const em = participanteEmail.trim();
      if (!n || !em) {
        setError(
          "Informe nome e e-mail do participante, ou marque que é o mesmo que quem paga.",
        );
        return;
      }
    }

    const body: Record<string, unknown> = {
      evento_id: eventoId,
      valor_centavos,
    };
    if (!mesmoPagador) {
      body.participante_nome = participanteNome.trim();
      body.participante_email = participanteEmail.trim();
    }

    setCreating(true);
    try {
      const data = await apiFetch<CriarPagamentoResponse>(
        "/api/pagamentos/criar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (data.stripe_disabled) {
        setPagamentoModoTeste(true);
        setIngressoId(data.ingresso_id);
        return;
      }
      setClientSecret(data.client_secret);
      setIngressoId(data.ingresso_id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível iniciar o pagamento",
      );
    } finally {
      setCreating(false);
    }
  }

  const stripePubOk = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const avisoSemStripePub =
    !stripePubOk && !process.env.NEXT_PUBLIC_STRIPE_DISABLED;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Comprar ingresso</h2>
      <p className="mt-1 text-xs text-zinc-600">{eventoNome}</p>

      {process.env.NEXT_PUBLIC_STRIPE_DISABLED === "true" ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Modo de teste no site: a confirmação do pagamento depende da API (
          <code className="rounded bg-amber-100/80 px-1">STRIPE_DISABLED</code> no backend).
        </p>
      ) : null}

      {avisoSemStripePub ? (
        <p className="mt-3 text-sm text-amber-800">
          Configure{" "}
          <code className="rounded bg-amber-100 px-1">
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
          </code>{" "}
          em <code className="rounded bg-amber-100 px-1">frontend/.env.local</code>
          .
        </p>
      ) : null}

      {pagamentoModoTeste && ingressoId ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-950">
          <p className="font-medium">Ingresso registrado (modo sem Stripe na API)</p>
          <p className="mt-1 text-xs text-emerald-900/90">
            Não houve cobrança em cartão. Quando o Stripe estiver configurado, desative{" "}
            <code className="rounded bg-white/80 px-1">STRIPE_DISABLED</code> no servidor.
          </p>
          <Link
            href={`/conta/pagamentos?ok=1&ingresso=${ingressoId}`}
            className="btn-success mt-4 inline-flex text-white"
          >
            Ver em meus pagamentos
          </Link>
        </div>
      ) : !clientSecret ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
            <span className="text-zinc-600">Valor do ingresso: </span>
            <span className="font-semibold text-zinc-900">
              {precoIngresso.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
            <p className="font-medium text-zinc-900">Quem vai ao evento</p>
            <p className="mt-1 text-xs text-zinc-600">
              O pagamento usa a sua conta logada (responsável financeiro). O participante pode
              ser outra pessoa — útil para pais, empresas ou compras em grupo.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={mesmoPagador}
                onChange={(e) => {
                  setMesmoPagador(e.target.checked);
                  if (e.target.checked) {
                    setParticipanteNome("");
                    setParticipanteEmail("");
                  }
                }}
                className="rounded border-zinc-300"
              />
              O participante é o mesmo que quem paga (eu)
            </label>
            {!mesmoPagador ? (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_nome">
                    Nome do participante
                  </label>
                  <input
                    id="part_nome"
                    value={participanteNome}
                    onChange={(e) => setParticipanteNome(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    placeholder="Nome completo"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_email">
                    E-mail do participante
                  </label>
                  <input
                    id="part_email"
                    type="email"
                    value={participanteEmail}
                    onChange={(e) => setParticipanteEmail(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    placeholder="email@exemplo.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <p className="text-xs text-zinc-500">
            Faça login em <a href="/auth" className="underline">Entrar</a> antes
            de pagar.
          </p>
          <button
            type="button"
            onClick={() => void criarIntent()}
            disabled={creating}
            className="btn-primary w-full"
          >
            {creating ? "Gerando pagamento…" : "Continuar para o cartão"}
          </button>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <Elements
            key={clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            {ingressoId ? <ConfirmForm ingressoId={ingressoId} /> : null}
          </Elements>
        </div>
      )}
    </div>
  );
}
