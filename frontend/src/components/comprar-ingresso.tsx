"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CheckoutAsaasPainel } from "@/components/checkout-asaas-painel";
import { CheckoutBadgesPagamento } from "@/components/checkout-badges-pagamento";
import { CheckoutConfirmacaoIngresso } from "@/components/checkout-confirmacao-ingresso";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { CheckoutAuthPanel } from "@/components/checkout-auth-panel";
import {
  CheckoutPixPainel,
  carregarPixDoIntent,
  type PixDisplayData,
} from "@/components/checkout-pix-painel";
import { CheckoutPrecoDetalhe } from "@/components/checkout-preco-detalhe";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import { authHrefParaComprarIngresso } from "@/lib/criar-evento-routes";
import { apiFetch, fetchSession } from "@/lib/api";
import { isDevCheckoutWarning, mapCheckoutError } from "@/lib/checkout-errors";
import { urlPosCompraEventoAbsoluta } from "@/lib/checkout-return";
import { CheckoutTermoResponsabilidade } from "@/components/checkout-termo-responsabilidade";
import { TERMO_COMPRA_VERSAO } from "@/lib/termo-compra";
import { formatCpfMask, isValidCpf, onlyDigits } from "@/lib/cpf";
import { getStripe } from "@/lib/stripe-client";
import { formatTelefoneBrMask, isTelefoneBrasilOk } from "@/lib/telefone-br";
import type { CriarPagamentoResponse, IngressoLote, RetomarPagamentoResponse, Usuario } from "@/lib/types";
import { urlRetomarPagamento } from "@/lib/reserva-pagamento";

type Props = {
  eventoId: string;
  eventoSlug: string;
  eventoNome: string;
  precoIngresso: number;
  limiteIngressosPorCpf?: number | null;
  compraDisponivel?: boolean;
  motivoCompraIndisponivel?: string | null;
  embedded?: boolean;
  /** Sessão já obtida pela página pai — evita refetch e layout shift. */
  usuarioInicial?: Usuario | null;
  sessaoInicialResolvida?: boolean;
  /** Retoma pagamento pendente (query ?retomar=). */
  ingressoRetomarId?: string | null;
  mensagemConfirmacao?: string | null;
  /** Nome do lote atualmente à venda (ex.: "1º lote"). */
  loteAtivoNome?: string | null;
  ingressoLotes?: IngressoLote[];
  loteCompraId?: string | null;
  eventoDataInicio?: string;
  eventoDataFim?: string;
  eventoLocal?: string;
  parcelamentoHabilitado?: boolean;
  parcelamentoMax?: number;
  urgenciaAtivo?: boolean;
  urgenciaBadge?: string | null;
  tokenEspera?: string | null;
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
  returnUrl,
}: {
  clientSecret: string;
  valorFmt: string;
  participante: ParticipanteCheckout;
  pixDisponivel: boolean;
  onSuccess: () => void;
  returnUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pixData, setPixData] = useState<PixDisplayData | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>(pixDisponivel ? "pix" : "card");
  const [cpfPix, setCpfPix] = useState(participante.cpf ?? "");

  useEffect(() => {
    if (participante.cpf) setCpfPix(participante.cpf);
  }, [participante.cpf]);

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
      setMsg(mapCheckoutError(pixResult.error.message ?? "Falha ao gerar o PIX."));
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
      setMsg(mapCheckoutError(submitError.message ?? "Revise os dados do cartão."));
      return;
    }

    const cardResult = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setBusy(false);

    if (cardResult.error) {
      setMsg(mapCheckoutError(cardResult.error.message ?? "Falha no pagamento"));
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
      {!pixDisponivel && isDevCheckoutWarning() ? (
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

export function ComprarIngresso({
  eventoId,
  eventoSlug,
  eventoNome,
  precoIngresso,
  limiteIngressosPorCpf = null,
  compraDisponivel = true,
  motivoCompraIndisponivel = null,
  embedded = false,
  usuarioInicial = null,
  sessaoInicialResolvida = false,
  ingressoRetomarId = null,
  mensagemConfirmacao = null,
  loteAtivoNome = null,
  ingressoLotes = [],
  loteCompraId = null,
  eventoDataInicio,
  eventoDataFim,
  eventoLocal,
  parcelamentoHabilitado = false,
  parcelamentoMax = 2,
  urgenciaAtivo = false,
  urgenciaBadge = null,
  tokenEspera = null,
}: Props) {
  const searchParams = useSearchParams();
  const [quantidade, setQuantidade] = useState(1);

  const lotesElegiveis = useMemo(
    () =>
      ingressoLotes
        .filter((l) => l.elegivel_compra !== false && l.ativo)
        .sort((a, b) => a.ordem - b.ordem),
    [ingressoLotes],
  );

  const [loteSelecionadoId, setLoteSelecionadoId] = useState(
    loteCompraId ?? lotesElegiveis[0]?.id ?? "",
  );

  useEffect(() => {
    if (lotesElegiveis.some((l) => l.id === loteSelecionadoId)) return;
    const next = loteCompraId ?? lotesElegiveis[0]?.id ?? "";
    setLoteSelecionadoId(next);
  }, [loteCompraId, lotesElegiveis, loteSelecionadoId]);

  const loteAtual = useMemo(
    () => lotesElegiveis.find((l) => l.id === loteSelecionadoId) ?? lotesElegiveis[0],
    [lotesElegiveis, loteSelecionadoId],
  );

  const precoUnitario = loteAtual?.preco ?? precoIngresso;
  const maxQuantidade = useMemo(() => {
    let max = 10;
    if (limiteIngressosPorCpf && limiteIngressosPorCpf >= 1) {
      max = Math.min(max, limiteIngressosPorCpf);
    }
    if (loteAtual?.quantidade_maxima != null) {
      const restantes = Math.max(0, loteAtual.quantidade_maxima - (loteAtual.vendidos ?? 0));
      max = Math.min(max, restantes || 1);
    }
    return Math.max(1, max);
  }, [limiteIngressosPorCpf, loteAtual]);

  useEffect(() => {
    if (quantidade > maxQuantidade) setQuantidade(maxQuantidade);
  }, [maxQuantidade, quantidade]);

  const authLoginHref = authHrefParaComprarIngresso(eventoSlug);
  const authRegisterHref = authHrefParaComprarIngresso(eventoSlug, "register");
  const loteNomeExibicao = loteAtual?.nome ?? loteAtivoNome;
  const [step, setStep] = useState<CheckoutStep>(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ingressoId, setIngressoId] = useState<string | null>(null);
  const [reservadoAte, setReservadoAte] = useState<Date | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
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
  const [paymentProvider, setPaymentProvider] = useState<"asaas" | "stripe">("asaas");
  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomPreview, setCupomPreview] = useState<{
    codigo: string;
    valor_centavos: number;
    desconto_centavos: number;
  } | null>(null);
  const [cupomBusy, setCupomBusy] = useState(false);
  const [cupomMsg, setCupomMsg] = useState<string | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [sessaoUsuario, setSessaoUsuario] = useState<Usuario | null>(
    sessaoInicialResolvida ? usuarioInicial : null,
  );
  const [temToken, setTemToken] = useState(
    sessaoInicialResolvida ? Boolean(usuarioInicial) : false,
  );
  const [checandoSessao, setChecandoSessao] = useState(!sessaoInicialResolvida);
  const [retomandoPagamento, setRetomandoPagamento] = useState(false);
  const sessaoCarregadaRef = useRef(sessaoInicialResolvida);
  const retomarTentadoRef = useRef(false);
  const posCompraProcessadoRef = useRef(false);

  const stripePromise = useMemo(() => getStripe(), []);

  const returnUrlPagamento = useMemo(() => {
    if (!ingressoId || typeof window === "undefined") return "";
    return urlPosCompraEventoAbsoluta(window.location.origin, eventoSlug, ingressoId);
  }, [ingressoId, eventoSlug]);

  useEffect(() => {
    if (posCompraProcessadoRef.current) return;
    if (searchParams.get("compra") !== "ok") return;
    const ing = searchParams.get("ingresso");
    if (!ing) return;
    posCompraProcessadoRef.current = true;
    setIngressoId(ing);
    setStep(3);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("compra");
      url.searchParams.delete("ingresso");
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
      window.history.replaceState(null, "", next);
    }
  }, [searchParams]);

  // Countdown do prazo de reserva
  useEffect(() => {
    if (!reservadoAte || step !== 2) {
      setSegundosRestantes(null);
      return;
    }
    const calcular = () => {
      const diff = Math.floor((reservadoAte.getTime() - Date.now()) / 1000);
      setSegundosRestantes(Math.max(0, diff));
    };
    calcular();
    const id = setInterval(calcular, 1000);
    return () => clearInterval(id);
  }, [reservadoAte, step]);

  useEffect(() => {
    if (!sessaoInicialResolvida) return;
    setSessaoUsuario(usuarioInicial);
    setTemToken(Boolean(usuarioInicial));
    setChecandoSessao(false);
    sessaoCarregadaRef.current = true;
  }, [sessaoInicialResolvida, usuarioInicial]);

  // Revalida sessão quando a página do evento não trouxe usuário (evita falso "deslogado").
  useEffect(() => {
    if (!sessaoInicialResolvida || usuarioInicial) return;
    let cancelled = false;
    void (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      if (u) {
        setSessaoUsuario(u);
        setTemToken(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessaoInicialResolvida, usuarioInicial]);

  useEffect(() => {
    if (sessaoInicialResolvida) {
      const onSync = () => {
        void (async () => {
          const u = await fetchSession();
          setSessaoUsuario(u);
          setTemToken(Boolean(u));
        })();
      };
      window.addEventListener(AUTH_SYNC_EVENT, onSync);
      return () => window.removeEventListener(AUTH_SYNC_EVENT, onSync);
    }

    async function carregarSessao(silencioso = false) {
      if (!silencioso && !sessaoCarregadaRef.current) {
        setChecandoSessao(true);
      }
      const u = await fetchSession();
      setSessaoUsuario(u);
      setTemToken(Boolean(u));
      setChecandoSessao(false);
      sessaoCarregadaRef.current = true;
    }
    const onSync = () => void carregarSessao(true);
    void carregarSessao();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, onSync);
    };
  }, [sessaoInicialResolvida]);

  const logado = temToken || Boolean(sessaoUsuario);
  const devCheckout = isDevCheckoutWarning();

  useEffect(() => {
    if (!ingressoRetomarId || !logado || retomarTentadoRef.current || checandoSessao) return;
    retomarTentadoRef.current = true;
    setRetomandoPagamento(true);
    setError(null);

    void (async () => {
      try {
        const body: Record<string, unknown> = {
          ingresso_id: ingressoRetomarId,
          evento_id: eventoId,
        };
        if (tokenEspera?.trim()) {
          body.token_espera = tokenEspera.trim();
        }
        const data = await apiFetch<RetomarPagamentoResponse>("/api/pagamentos/retomar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (data.evento_slug && data.evento_slug !== eventoSlug) {
          window.location.assign(urlRetomarPagamento(data.evento_slug, ingressoRetomarId));
          return;
        }

        setTermoAceito(true);
        setIngressoId(data.ingresso_id);

        const pn = data.participante_nome?.trim();
        const pe = data.participante_email?.trim();
        if (pn && pe) {
          setParticipanteCheckout({ nome: pn, email: pe });
          setEmailConfirmacao(pe);
        }

        if (data.ja_pago || data.stripe_disabled || data.cortesia) {
          setPagamentoModoTeste(Boolean(data.stripe_disabled && !data.cortesia));
          setStep(3);
          return;
        }

        if (data.payment_provider === "asaas" || data.aguardando_cobranca) {
          setPaymentProvider("asaas");
          setClientSecret(null);
          setPixDisponivel(data.pix_disponivel !== false);
          if (data.reservado_ate) setReservadoAte(new Date(data.reservado_ate));
          setStep(2);
          return;
        }

        setPaymentProvider("stripe");
        setClientSecret(data.client_secret);
        setPixDisponivel(data.pix_disponivel !== false);
        if (data.reservado_ate) {
          setReservadoAte(new Date(data.reservado_ate));
        }
        setStep(2);
      } catch (e) {
        setError(mapCheckoutError(e instanceof Error ? e.message : "Não foi possível retomar o pagamento"));
      } finally {
        setRetomandoPagamento(false);
      }
    })();
  }, [ingressoRetomarId, logado, checandoSessao, eventoId, eventoSlug, tokenEspera]);

  const recarregarSessaoPosAuth = useCallback(() => {
    void (async () => {
      const u = await fetchSession();
      setSessaoUsuario(u);
      setTemToken(Boolean(u));
    })();
  }, []);

  const ehCortesia = Number.isFinite(precoUnitario) && precoUnitario < 0.5;
  const precoCentavosUnit = ehCortesia ? 0 : Math.round(precoUnitario * 100);
  const precoCentavosCheckout = cupomPreview?.valor_centavos ?? precoCentavosUnit * quantidade;
  const precoReaisCheckout = precoCentavosCheckout / 100;
  const precoFmt = ehCortesia
    ? "Cortesia (grátis)"
    : quantidade > 1
      ? `${quantidade}× ${precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} = ${precoReaisCheckout.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
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
        body: JSON.stringify({
          evento_id: eventoId,
          codigo_cupom: codigo,
          lote_id: loteSelecionadoId || undefined,
          quantidade,
        }),
      });
      setCupomPreview(r);
      setCupomMsg(
        r.desconto_centavos > 0
          ? `Cupom ${r.codigo} aplicado. Desconto de ${(r.desconto_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
          : `Cupom ${r.codigo} aplicado.`,
      );
    } catch (e) {
      setCupomPreview(null);
      setCupomMsg(mapCheckoutError(e instanceof Error ? e.message : "Cupom inválido."));
    } finally {
      setCupomBusy(false);
    }
  }

  async function criarIntent() {
    setError(null);
    const v = precoUnitario;
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

    if (!termoAceito) {
      setError("Leia e aceite o termo de responsabilidade para continuar.");
      return;
    }

    const body: Record<string, unknown> = {
      evento_id: eventoId,
      valor_centavos,
      quantidade,
    };
    if (loteSelecionadoId) body.lote_id = loteSelecionadoId;
    if (!mesmoPagador) {
      body.participante_nome = participanteNome.trim();
      body.participante_email = participanteEmail.trim();
      body.participante_cpf = onlyDigits(participanteCpfDigits, 11);
      body.participante_telefone = onlyDigits(participanteTelDigits, 11);
    } else if (exigeCpf) {
      body.participante_cpf = onlyDigits(participanteCpfDigits, 11);
    }
    if (ehCortesia && cortesiaResponsavel.trim()) {
      body.cortesia_responsavel = cortesiaResponsavel.trim();
    }
    const cupomCodigo = codigoCupom.trim();
    if (cupomCodigo && !ehCortesia) {
      body.codigo_cupom = cupomCodigo;
    }
    body.termo_compra_aceito = true;
    body.termo_compra_versao = TERMO_COMPRA_VERSAO;
    if (tokenEspera?.trim()) {
      body.token_espera = tokenEspera.trim();
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
      setIngressoId(data.ingresso_id);
      if (data.payment_provider === "asaas" || data.aguardando_cobranca) {
        setPaymentProvider("asaas");
        setClientSecret(null);
        setPixDisponivel(data.pix_disponivel !== false);
        if (data.reservado_ate) setReservadoAte(new Date(data.reservado_ate));
        setStep(2);
        return;
      }
      setPaymentProvider("stripe");
      setClientSecret(data.client_secret);
      setPixDisponivel(data.pix_disponivel !== false);
      if (data.reservado_ate) {
        setReservadoAte(new Date(data.reservado_ate));
      }
      setStep(2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível iniciar o pagamento";
      setError(mapCheckoutError(msg));
    } finally {
      setCreating(false);
    }
  }

  const stripePubOk = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const timerFmt =
    segundosRestantes !== null
      ? `${String(Math.floor(segundosRestantes / 60)).padStart(2, "0")}:${String(segundosRestantes % 60).padStart(2, "0")}`
      : null;
  const timerExpirou = segundosRestantes === 0;
  const avisoSemStripePub =
    devCheckout && !stripePubOk && !process.env.NEXT_PUBLIC_STRIPE_DISABLED;

  const shellClass = embedded
    ? "mt-0 border-0 bg-transparent p-0 shadow-none [&_p]:text-justify"
    : "mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 shadow-sm [&_p]:text-justify";

  if (!compraDisponivel) {
    return (
      <div className={shellClass}>
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold">Compras indisponíveis</p>
          <p className="mt-2 leading-relaxed">
            {motivoCompraIndisponivel ??
              "Não há ingressos à venda neste momento. Recarregue a página ou contacte o organizador."}
          </p>
        </div>
      </div>
    );
  }

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
        <CheckoutConfirmacaoIngresso
          ingressoId={ingressoId}
          eventoNome={eventoNome}
          emailParticipante={emailConfirmacao || "o e-mail da sua conta"}
          mensagemConfirmacao={mensagemConfirmacao}
          quantidade={quantidade}
          eventoDataInicio={eventoDataInicio}
          eventoDataFim={eventoDataFim}
          eventoLocal={eventoLocal}
          eventoUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/eventos/${eventoSlug}`
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <CheckoutStepper current={step} />

      {devCheckout && process.env.NEXT_PUBLIC_STRIPE_DISABLED === "true" ? (
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
          {retomandoPagamento ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              Retomando seu pagamento pendente…
            </div>
          ) : null}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {logado ? "1. Dados do participante" : "1. Identifique-se para comprar"}
            </h2>
            <p className="mt-1 text-xs text-zinc-600">{eventoNome}</p>
            {loteNomeExibicao ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="font-semibold">Ingresso selecionado:</span> {loteNomeExibicao} ·{" "}
                {precoFmt}
              </p>
            ) : null}
          </div>

          {lotesElegiveis.length > 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-700">Escolha o lote</p>
              <div className="space-y-2">
                {lotesElegiveis.map((l) => (
                  <label
                    key={l.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                      loteSelecionadoId === l.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="lote-checkout"
                        checked={loteSelecionadoId === l.id}
                        onChange={() => {
                          setLoteSelecionadoId(l.id);
                          setCupomPreview(null);
                          setCupomMsg(null);
                        }}
                      />
                      {l.nome}
                    </span>
                    <span className="font-medium tabular-nums text-zinc-800">
                      {l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {maxQuantidade > 1 ? (
            <div>
              <label htmlFor="qtd-ingressos" className="text-xs font-medium text-zinc-700">
                Quantidade
              </label>
              <select
                id="qtd-ingressos"
                value={quantidade}
                onChange={(e) => {
                  setQuantidade(Number(e.target.value));
                  setCupomPreview(null);
                  setCupomMsg(null);
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm"
              >
                {Array.from({ length: maxQuantidade }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} ingresso{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!ehCortesia ? (
            <>
              {urgenciaAtivo && urgenciaBadge ? (
                <p
                  className="inline-flex w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950"
                  role="status"
                >
                  {urgenciaBadge}
                </p>
              ) : null}
              <CheckoutPrecoDetalhe precoIngresso={precoReaisCheckout} destaque />
              {cupomPreview && cupomPreview.desconto_centavos > 0 ? (
                <p className="text-xs text-emerald-800">
                  Preço original{" "}
                  {(precoUnitario * quantidade).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  — desconto
                  aplicado com cupom <strong>{cupomPreview.codigo}</strong>.
                </p>
              ) : null}
              <details className="rounded-md border border-zinc-200 bg-white text-sm shadow-sm" open={Boolean(codigoCupom)}>
                <summary className="cursor-pointer px-3 py-2.5 font-medium text-zinc-900 hover:bg-zinc-50">
                  Tem cupom de desconto?
                </summary>
                <div className="border-t border-zinc-100 px-3 pb-3 pt-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
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
              </details>
            </>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Cortesia</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{precoFmt}</p>
            </div>
          )}

          <div className="min-h-[300px]">
          {checandoSessao ? (
            <div className="animate-pulse space-y-3 rounded-md border border-zinc-200 bg-white p-4">
              <div className="h-4 w-2/3 rounded bg-zinc-200" />
              <div className="h-10 rounded bg-zinc-100" />
              <div className="h-10 rounded bg-zinc-100" />
            </div>
          ) : !logado ? (
            <CheckoutAuthPanel
              authLoginHref={authLoginHref}
              authRegisterHref={authRegisterHref}
              onAuthenticated={recarregarSessaoPosAuth}
            />
          ) : (
            <>
              {ehCortesia ? (
                <div className="rounded-md border border-violet-200 bg-violet-50/80 px-3 py-3 text-sm">
                  <label className="text-xs font-medium text-violet-900" htmlFor="cortesia_resp">
                    Responsável pela cortesia{" "}
                    <span className="font-normal text-violet-700">(opcional)</span>
                  </label>
                  <input
                    id="cortesia_resp"
                    value={cortesiaResponsavel}
                    onChange={(e) => setCortesiaResponsavel(e.target.value)}
                    placeholder="Ex.: organizador ou patrocinador"
                    className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1.5 text-sm"
                    maxLength={200}
                  />
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

              <p className="text-xs text-zinc-600">
                {sessaoUsuario ? (
                  <>
                    Comprando como{" "}
                    <strong className="font-medium text-zinc-800">{sessaoUsuario.nome}</strong>
                    <span className="text-zinc-500"> ({sessaoUsuario.email})</span>
                  </>
                ) : (
                  "Sessão ativa — pode continuar."
                )}
              </p>

              <CheckoutTermoResponsabilidade
                eventoNome={eventoNome}
                aceito={termoAceito}
                onAceitoChange={setTermoAceito}
                disabled={creating}
              />

              <div className="sticky bottom-0 z-10 -mx-1 border-t border-zinc-200 bg-white/95 px-1 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
              <button
                type="button"
                data-testid="checkout-continuar"
                onClick={() => void criarIntent()}
                disabled={creating || !termoAceito}
                className="btn-primary w-full"
              >
                {creating
                  ? "Preparando…"
                  : ehCortesia
                    ? "Confirmar cortesia"
                    : "Continuar para pagamento"}
              </button>
              </div>
              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
          </div>
        </div>
      ) : step === 2 && ingressoId && (paymentProvider === "asaas" || (clientSecret && stripePubOk)) ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">2. Pagamento</h2>
            <p className="mt-1 text-xs text-zinc-600">
              PIX ou cartão via Asaas · total {precoFmt}
            </p>
          </div>

          {timerFmt && !timerExpirou ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span>
                Você tem{" "}
                <span className="font-mono font-bold">{timerFmt}</span> para concluir — depois a reserva
                é liberada.
              </span>
            </div>
          ) : timerExpirou ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>O tempo de reserva expirou.</strong> Sua vaga foi liberada.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => { setStep(1); setClientSecret(null); setReservadoAte(null); }}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            <span>🔒 Pagamento seguro via Asaas</span>
            <span>Reembolso em até 10 dias</span>
            <span>Ingresso por e-mail + QR Code</span>
          </div>

          {!ehCortesia ? <CheckoutPrecoDetalhe precoIngresso={precoReaisCheckout} /> : null}
          <CheckoutBadgesPagamento />
          <button
            type="button"
            className="text-xs text-zinc-600 underline"
            onClick={() => {
              setStep(1);
              setClientSecret(null);
              setReservadoAte(null);
            }}
          >
            ← Voltar aos dados
          </button>
          {!timerExpirou ? (
            paymentProvider === "asaas" && participanteCheckout ? (
              <CheckoutAsaasPainel
                ingressoId={ingressoId}
                valorFmt={precoFmt}
                valorCentavos={precoCentavosCheckout}
                participanteNome={participanteCheckout.nome}
                participanteEmail={participanteCheckout.email}
                participanteCpf={participanteCheckout.cpf}
                reservadoAte={reservadoAte?.toISOString()}
                parcelamentoHabilitado={parcelamentoHabilitado}
                parcelamentoMax={parcelamentoMax}
                tokenEspera={tokenEspera}
                onSuccess={() => setStep(3)}
              />
            ) : (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{ clientSecret: clientSecret!, appearance: { theme: "stripe" } }}
            >
              {clientSecret && participanteCheckout ? (
                <ConfirmForm
                  clientSecret={clientSecret}
                  valorFmt={precoFmt}
                  participante={participanteCheckout}
                  pixDisponivel={pixDisponivel}
                  onSuccess={() => setStep(3)}
                  returnUrl={returnUrlPagamento}
                />
              ) : null}
            </Elements>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-red-800" role="alert">
          Não foi possível carregar o pagamento. Recarregue a página ou volte à etapa anterior.
        </p>
      )}
    </div>
  );
}
