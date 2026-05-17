"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CheckoutStepper } from "@/components/checkout-stepper";
import {
  CheckoutPixPainel,
  carregarPixDoIntent,
  type PixDisplayData,
} from "@/components/checkout-pix-painel";
import { CheckoutPrecoDetalhe } from "@/components/checkout-preco-detalhe";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { formatCpfMask, isValidCpf, onlyDigits } from "@/lib/cpf";
import { getStripe } from "@/lib/stripe-client";
import { formatTelefoneBrMask, isTelefoneBrasilOk } from "@/lib/telefone-br";
import type { CriarPagamentoResponse, Usuario } from "@/lib/types";

type Props = {
  eventoId: string;
  eventoNome: string;
  precoIngresso: number;
  limiteIngressosPorCpf?: number | null;
  embedded?: boolean;
};

type CheckoutStep = 1 | 2 | 3;
type MetodoPagamento = "pix" | "card";

export type ParticipanteCheckout = {
  nome: string;
  email: string;
  cpf?: string;
};

function ConfirmForm({
  clientSecret,
  valorFmt,
  participante,
  pixDisponivel,
  onSuccess,
}: {
  clientSecret: string;
  valorFmt: string;
  participante: ParticipanteCheckout;
  pixDisponivel: boolean;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pixData, setPixData] = useState<PixDisplayData | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>(pixDisponivel ? "pix" : "card");
  const [cpfPix, setCpfPix] = useState(participante.cpf ?? "");

  const returnUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/conta/pagamentos`;

  async function gerarPix(e: FormEvent) {
    e.preventDefault();
    if (!stripe) return;
    const cpf = onlyDigits(cpfPix, 11);
    if (!participante.nome.trim() || !participante.email.trim()) {
      setMsg("Nome e e-mail do participante são obrigatórios para PIX.");
      return;
    }
    if (!isValidCpf(cpf)) {
      setMsg("Informe um CPF válido (11 dígitos) para gerar o PIX.");
      return;
    }

    setBusy(true);
    setMsg(null);
    const pixResult = await stripe.confirmPixPayment(
      clientSecret,
      {
        payment_method: {
          billing_details: {
            name: participante.nome.trim(),
            email: participante.email.trim(),
            tax_id: cpf,
          } as { name: string; email: string; tax_id: string },
        },
        return_url: returnUrl,
      },
      { handleActions: false },
    );
    setBusy(false);

    if (pixResult.error) {
      setMsg(pixResult.error.message ?? "Falha ao gerar o PIX.");
      return;
    }
    const paymentIntent = pixResult.paymentIntent;
    if (!paymentIntent) return;
    if (paymentIntent.status === "succeeded") {
      onSuccess();
      return;
    }
    const pix = await carregarPixDoIntent(stripe, clientSecret, paymentIntent);
    if (pix) {
      setPixData(pix);
      return;
    }
    setMsg(
      "Não foi possível exibir o QR Code. Verifique se o PIX está ativo na sua conta Stripe (Dashboard → Configurações → Formas de pagamento).",
    );
  }

  async function pagarCartao(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMsg(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setBusy(false);
      setMsg(submitError.message ?? "Revise os dados do cartão.");
      return;
    }

    const cardResult = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setBusy(false);

    if (cardResult.error) {
      setMsg(cardResult.error.message ?? "Falha no pagamento");
      return;
    }
    const paymentIntent = cardResult.paymentIntent;
    if (!paymentIntent) return;
    if (paymentIntent.status === "succeeded") {
      onSuccess();
      return;
    }
    const pix = await carregarPixDoIntent(stripe, clientSecret, paymentIntent);
    if (pix) {
      setPixData(pix);
      return;
    }
    if (paymentIntent.status === "processing") {
      setMsg("Pagamento em processamento. Aguarde a confirmação.");
      return;
    }
    setMsg("Não foi possível concluir o pagamento com cartão.");
  }

  if (pixData && stripe) {
    return (
      <CheckoutPixPainel
        stripe={stripe}
        clientSecret={clientSecret}
        pix={pixData}
        valorFmt={valorFmt}
        onPago={onSuccess}
        onExpirado={() => {
          setPixData(null);
          setMsg("O PIX expirou. Gere um novo código abaixo.");
        }}
      />
    );
  }

  const tabClass = (ativo: boolean) =>
    `flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
      ativo
        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
    }`;

  return (
    <div className="space-y-4">
      {!pixDisponivel ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          PIX indisponível nesta conta Stripe (ative em{" "}
          <a
            href="https://dashboard.stripe.com/settings/payment_methods"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Formas de pagamento
          </a>
          ). Use cartão por agora.
        </p>
      ) : null}
      <div className="flex gap-2" role="tablist" aria-label="Forma de pagamento">
        {pixDisponivel ? (
          <button type="button" role="tab" aria-selected={metodo === "pix"} className={tabClass(metodo === "pix")} onClick={() => setMetodo("pix")}>
            PIX
          </button>
        ) : null}
        <button type="button" role="tab" aria-selected={metodo === "card"} className={tabClass(metodo === "card")} onClick={() => setMetodo("card")}>
          Cartão
        </button>
      </div>

      {metodo === "pix" && pixDisponivel ? (
        <form onSubmit={(e) => void gerarPix(e)} className="space-y-4">
          <p className="text-xs text-zinc-600">
            Gere o QR Code na hora. Pagamento para{" "}
            <strong>{participante.nome}</strong> ({participante.email}).
          </p>
          <div>
            <label className="text-xs font-medium text-zinc-700" htmlFor="pix_cpf">
              CPF do pagador <span className="text-red-600">*</span>
            </label>
            <input
              id="pix_cpf"
              inputMode="numeric"
              value={formatCpfMask(cpfPix)}
              onChange={(ev) => setCpfPix(onlyDigits(ev.target.value, 11))}
              maxLength={14}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-zinc-500">Exigido pelo Stripe para pagamentos PIX no Brasil.</p>
          </div>
          {msg ? (
            <p className="text-sm text-red-600" role="alert">
              {msg}
            </p>
          ) : null}
          <button type="submit" disabled={!stripe || busy} className="btn-success w-full">
            {busy ? "Gerando QR Code…" : "Gerar QR Code PIX"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void pagarCartao(e)} className="space-y-4">
          <PaymentElement
            options={{
              layout: { type: "tabs", defaultCollapsed: false },
              paymentMethodOrder: ["card"],
            }}
          />
          {msg ? (
            <p className="text-sm text-red-600" role="alert">
              {msg}
            </p>
          ) : null}
          <button type="submit" disabled={!stripe || busy} className="btn-success w-full">
            {busy ? "Processando…" : "Pagar com cartão"}
          </button>
        </form>
      )}
    </div>
  );
}

function ConfirmacaoIngresso({
  ingressoId,
  eventoNome,
  emailParticipante,
}: {
  ingressoId: string;
  eventoNome: string;
  emailParticipante: string;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("eventosbr_token") : null;
    if (!token) return;

    void (async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/ingressos/${ingressoId}/qr`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) setQrUrl(URL.createObjectURL(blob));
      } catch {
        /* QR opcional na confirmação */
      }
    })();

    return () => {
      cancelled = true;
      if (qrUrl) URL.revokeObjectURL(qrUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- qrUrl cleanup on unmount only
  }, [ingressoId]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-3xl" aria-hidden>
        ✓
      </p>
      <h2 className="text-lg font-semibold text-emerald-900">Compra confirmada!</h2>
      <p className="text-sm text-zinc-600">{eventoNome}</p>
      <p className="text-sm text-zinc-700">
        Enviamos o ingresso com QR Code para{" "}
        <strong className="text-zinc-900">{emailParticipante}</strong> (verifique o spam).
      </p>
      {qrUrl ? (
        <div className="mx-auto inline-block rounded-lg border border-zinc-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code do ingresso" width={180} height={180} className="mx-auto" />
          <p className="mt-2 text-[11px] text-zinc-500">Apresente na entrada do evento</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/conta/ingressos/${ingressoId}`} className="btn-success text-white">
          Ver meu ingresso
        </Link>
        <Link href="/conta/pagamentos" className="btn-outline">
          Meus pagamentos
        </Link>
      </div>
    </div>
  );
}

export function ComprarIngresso({
  eventoId,
  eventoNome,
  precoIngresso,
  limiteIngressosPorCpf = null,
  embedded = false,
}: Props) {
  const [step, setStep] = useState<CheckoutStep>(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ingressoId, setIngressoId] = useState<string | null>(null);
  const [emailConfirmacao, setEmailConfirmacao] = useState("");
  const [pagamentoModoTeste, setPagamentoModoTeste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [mesmoPagador, setMesmoPagador] = useState(true);
  const [participanteNome, setParticipanteNome] = useState("");
  const [participanteEmail, setParticipanteEmail] = useState("");
  const [participanteCpfDigits, setParticipanteCpfDigits] = useState("");
  const [participanteTelDigits, setParticipanteTelDigits] = useState("");
  const [cortesiaResponsavel, setCortesiaResponsavel] = useState("");
  const [participanteCheckout, setParticipanteCheckout] = useState<ParticipanteCheckout | null>(
    null,
  );
  const [pixDisponivel, setPixDisponivel] = useState(true);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomPreview, setCupomPreview] = useState<{
    codigo: string;
    valor_centavos: number;
    desconto_centavos: number;
  } | null>(null);
  const [cupomBusy, setCupomBusy] = useState(false);
  const [cupomMsg, setCupomMsg] = useState<string | null>(null);

  const stripePromise = useMemo(() => getStripe(), []);

  const ehCortesia = Number.isFinite(precoIngresso) && precoIngresso < 0.5;
  const precoCentavosBase = ehCortesia ? 0 : Math.round(precoIngresso * 100);
  const precoCentavosCheckout = cupomPreview?.valor_centavos ?? precoCentavosBase;
  const precoReaisCheckout = precoCentavosCheckout / 100;
  const precoFmt = ehCortesia
    ? "Cortesia (grátis)"
    : precoReaisCheckout.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
  const exigeCpf = Boolean(limiteIngressosPorCpf && limiteIngressosPorCpf >= 1);

  const alertaCpfParticipante = useMemo(() => {
    if (mesmoPagador && !exigeCpf) return null;
    const d = onlyDigits(participanteCpfDigits, 11);
    if (d.length === 0) return null;
    if (d.length < 11) return "Digite os 11 dígitos do CPF.";
    if (!isValidCpf(d)) return "CPF inválido. Verifique os números.";
    return null;
  }, [mesmoPagador, exigeCpf, participanteCpfDigits]);

  async function aplicarCupom() {
    const codigo = codigoCupom.trim();
    if (!codigo || ehCortesia) return;
    setCupomBusy(true);
    setCupomMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{
        codigo: string;
        valor_centavos: number;
        desconto_centavos: number;
      }>("/api/pagamentos/validar-cupom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evento_id: eventoId, codigo_cupom: codigo }),
      });
      setCupomPreview(r);
      setCupomMsg(
        r.desconto_centavos > 0
          ? `Cupom ${r.codigo} aplicado. Desconto de ${(r.desconto_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
          : `Cupom ${r.codigo} aplicado.`,
      );
    } catch (e) {
      setCupomPreview(null);
      setCupomMsg(e instanceof Error ? e.message : "Cupom inválido.");
    } finally {
      setCupomBusy(false);
    }
  }

  async function criarIntent() {
    setError(null);
    const v = precoIngresso;
    if (!Number.isFinite(v) || (!ehCortesia && v < 0.5)) {
      setError("Preço do ingresso inválido para pagamento (mínimo R$ 0,50).");
      return;
    }
    const valor_centavos = ehCortesia ? 0 : precoCentavosCheckout;
    if (!ehCortesia && valor_centavos < 50) {
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
      if (!isValidCpf(participanteCpfDigits)) {
        setError("CPF do participante inválido. Confira os 11 dígitos.");
        return;
      }
      if (!isTelefoneBrasilOk(participanteTelDigits)) {
        setError("Telefone inválido: use DDD + número (10 ou 11 dígitos).");
        return;
      }
      setEmailConfirmacao(em);
      setParticipanteCheckout({
        nome: n,
        email: em,
        cpf: onlyDigits(participanteCpfDigits, 11),
      });
    } else {
      try {
        const me = await apiFetch<Usuario>("/api/auth/me");
        setEmailConfirmacao(me.email);
        const cpfMe = exigeCpf ? onlyDigits(participanteCpfDigits, 11) : undefined;
        setParticipanteCheckout({
          nome: me.nome,
          email: me.email,
          cpf: cpfMe,
        });
      } catch {
        setEmailConfirmacao("");
        setParticipanteCheckout(null);
      }
    }

    if (exigeCpf && mesmoPagador) {
      if (!isValidCpf(participanteCpfDigits)) {
        setError("Informe seu CPF (obrigatório neste evento).");
        return;
      }
    }

    if (ehCortesia && !cortesiaResponsavel.trim()) {
      setError("Informe quem autorizou a cortesia (responsável).");
      return;
    }

    const body: Record<string, unknown> = {
      evento_id: eventoId,
      valor_centavos,
    };
    if (!mesmoPagador) {
      body.participante_nome = participanteNome.trim();
      body.participante_email = participanteEmail.trim();
      body.participante_cpf = onlyDigits(participanteCpfDigits, 11);
      body.participante_telefone = onlyDigits(participanteTelDigits, 11);
    } else if (exigeCpf) {
      body.participante_cpf = onlyDigits(participanteCpfDigits, 11);
    }
    if (ehCortesia) {
      body.cortesia_responsavel = cortesiaResponsavel.trim();
    }
    const cupomCodigo = codigoCupom.trim();
    if (cupomCodigo && !ehCortesia) {
      body.codigo_cupom = cupomCodigo;
    }

    setCreating(true);
    try {
      const data = await apiFetch<CriarPagamentoResponse>("/api/pagamentos/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (data.stripe_disabled || data.cortesia) {
        setPagamentoModoTeste(Boolean(data.stripe_disabled && !data.cortesia));
        setIngressoId(data.ingresso_id);
        setStep(3);
        return;
      }
      setClientSecret(data.client_secret);
      setIngressoId(data.ingresso_id);
      setPixDisponivel(data.pix_disponivel !== false);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento");
    } finally {
      setCreating(false);
    }
  }

  const stripePubOk = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const avisoSemStripePub =
    !stripePubOk && !process.env.NEXT_PUBLIC_STRIPE_DISABLED;

  const shellClass = embedded
    ? "mt-0 border-0 bg-transparent p-0 shadow-none [&_p]:text-justify"
    : "mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 shadow-sm [&_p]:text-justify";

  if (step === 3 && ingressoId) {
    return (
      <div className={`${shellClass} [&_p]:text-center`}>
        <CheckoutStepper current={3} />
        {pagamentoModoTeste ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-medium">Modo teste (sem cobrança real)</p>
            <p className="mt-1 text-xs">Ingresso registrado na API com STRIPE_DISABLED.</p>
          </div>
        ) : null}
        <ConfirmacaoIngresso
          ingressoId={ingressoId}
          eventoNome={eventoNome}
          emailParticipante={emailConfirmacao || "o e-mail da sua conta"}
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <CheckoutStepper current={step} />

      {process.env.NEXT_PUBLIC_STRIPE_DISABLED === "true" ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Modo de teste no site (STRIPE_DISABLED na API).
        </p>
      ) : null}

      {avisoSemStripePub ? (
        <p className="mb-3 text-sm text-amber-800">
          Configure <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
          em <code className="rounded bg-amber-100 px-1">frontend/.env.local</code>.
        </p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">1. Dados do participante</h2>
            <p className="mt-1 text-xs text-zinc-600">{eventoNome}</p>
          </div>

          {!ehCortesia ? (
            <>
              <CheckoutPrecoDetalhe precoIngresso={precoReaisCheckout} destaque />
              {cupomPreview && cupomPreview.desconto_centavos > 0 ? (
                <p className="text-xs text-emerald-800">
                  Preço original{" "}
                  {precoIngresso.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — desconto
                  aplicado com cupom <strong>{cupomPreview.codigo}</strong>.
                </p>
              ) : null}
              <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-sm">
                <p className="font-medium text-zinc-900">Cupom de desconto</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={codigoCupom}
                    onChange={(e) => {
                      setCodigoCupom(e.target.value.toUpperCase());
                      setCupomPreview(null);
                      setCupomMsg(null);
                    }}
                    placeholder="Ex.: PROMO10"
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm uppercase"
                    maxLength={40}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void aplicarCupom()}
                    disabled={cupomBusy || !codigoCupom.trim()}
                    className="btn-outline shrink-0 px-4 py-1.5 text-sm"
                  >
                    {cupomBusy ? "Validando…" : "Aplicar"}
                  </button>
                </div>
                {cupomMsg ? (
                  <p
                    className={`mt-2 text-xs ${cupomPreview ? "text-emerald-800" : "text-red-600"}`}
                    role="status"
                  >
                    {cupomMsg}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Cortesia</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{precoFmt}</p>
            </div>
          )}

          {ehCortesia ? (
            <div className="rounded-md border border-violet-200 bg-violet-50/80 px-3 py-3 text-sm">
              <label className="text-xs font-medium text-violet-900" htmlFor="cortesia_resp">
                Responsável pela cortesia <span className="text-red-600">*</span>
              </label>
              <input
                id="cortesia_resp"
                value={cortesiaResponsavel}
                onChange={(e) => setCortesiaResponsavel(e.target.value)}
                placeholder="Ex.: nome do organizador ou patrocinador"
                className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1.5 text-sm"
                maxLength={200}
              />
              <p className="mt-1 text-[11px] text-violet-800/90">
                Registro interno de quem autorizou o ingresso gratuito.
              </p>
            </div>
          ) : null}

          <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <p className="font-medium text-zinc-900">Quem vai ao evento</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={mesmoPagador}
                onChange={(e) => {
                  setMesmoPagador(e.target.checked);
                  if (e.target.checked) {
                    setParticipanteNome("");
                    setParticipanteEmail("");
                    setParticipanteCpfDigits("");
                    setParticipanteTelDigits("");
                  }
                }}
                className="rounded border-zinc-300"
              />
              Sou eu (mesmo e-mail da conta)
            </label>
            {!mesmoPagador ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_nome">
                    Nome
                  </label>
                  <input
                    id="part_nome"
                    value={participanteNome}
                    onChange={(e) => setParticipanteNome(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_email">
                    E-mail
                  </label>
                  <input
                    id="part_email"
                    type="email"
                    value={participanteEmail}
                    onChange={(e) => setParticipanteEmail(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_cpf">
                    CPF
                  </label>
                  <input
                    id="part_cpf"
                    inputMode="numeric"
                    value={formatCpfMask(participanteCpfDigits)}
                    onChange={(e) => setParticipanteCpfDigits(onlyDigits(e.target.value, 11))}
                    maxLength={14}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  {alertaCpfParticipante ? (
                    <p className="mt-1 text-xs text-red-600">{alertaCpfParticipante}</p>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="part_tel">
                    Telefone
                  </label>
                  <input
                    id="part_tel"
                    inputMode="tel"
                    value={formatTelefoneBrMask(participanteTelDigits)}
                    onChange={(e) => setParticipanteTelDigits(onlyDigits(e.target.value, 11))}
                    className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ) : null}
            {exigeCpf && mesmoPagador ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-zinc-700" htmlFor="cpf_comprador">
                  Seu CPF <span className="text-red-600">*</span>
                </label>
                <input
                  id="cpf_comprador"
                  inputMode="numeric"
                  value={formatCpfMask(participanteCpfDigits)}
                  onChange={(e) => setParticipanteCpfDigits(onlyDigits(e.target.value, 11))}
                  maxLength={14}
                  className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Limite de {limiteIngressosPorCpf} ingresso(s) por CPF neste evento.
                </p>
                {alertaCpfParticipante ? (
                  <p className="mt-1 text-xs text-red-600">{alertaCpfParticipante}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="text-xs text-zinc-500">
            <Link href="/auth" className="underline">
              Entrar
            </Link>{" "}
            antes de continuar, se ainda não tiver conta.
          </p>
          <button
            type="button"
            onClick={() => void criarIntent()}
            disabled={creating}
            className="btn-primary w-full"
          >
            {creating ? "Preparando…" : "Continuar para pagamento"}
          </button>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : step === 2 && clientSecret && stripePubOk ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">2. Pagamento</h2>
            <p className="mt-1 text-xs text-zinc-600">
              PIX (QR com timer) ou cartão via Stripe · total {precoFmt}
            </p>
          </div>
          {!ehCortesia ? <CheckoutPrecoDetalhe precoIngresso={precoReaisCheckout} /> : null}
          <button
            type="button"
            className="text-xs text-zinc-600 underline"
            onClick={() => {
              setStep(1);
              setClientSecret(null);
            }}
          >
            ← Voltar aos dados
          </button>
          <Elements
            key={clientSecret}
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            {clientSecret && participanteCheckout ? (
              <ConfirmForm
                clientSecret={clientSecret}
                valorFmt={precoFmt}
                participante={participanteCheckout}
                pixDisponivel={pixDisponivel}
                onSuccess={() => setStep(3)}
              />
            ) : null}
          </Elements>
        </div>
      ) : (
        <p className="text-sm text-red-800" role="alert">
          Não foi possível carregar o pagamento. Recarregue a página ou volte à etapa anterior.
        </p>
      )}
    </div>
  );
}
