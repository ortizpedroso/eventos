import Link from "next/link";
import {
  MENSALIDADE_ASSINATURA_MENSAL,
  TARIFA_ASSINATURA,
  TARIFA_PADRAO,
  formatBrl,
  formatPercentual,
} from "@/lib/tarifas-plataforma";
import { hrefCriarEvento } from "@/lib/criar-evento-routes";

const CRIAR_CONTA_HREF = hrefCriarEvento;

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.412-.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-x-3 text-sm text-zinc-600">
      <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  );
}

type Props = {
  compact?: boolean;
};

export function PlanosPricingCards({ compact = false }: Props) {
  return (
    <div className={`grid grid-cols-1 gap-6 text-left lg:grid-cols-3 lg:gap-8 ${compact ? "mt-8" : "mt-12"}`}>
      <div className="card-interactive h-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-semibold text-zinc-900">Eventos gratuitos</h3>
        <p className="mt-2 text-sm text-zinc-500">Comunidades, meetups e encontros sem cobrança.</p>
        <div className="mt-6 flex items-baseline gap-x-1">
          <span className="text-4xl font-bold text-zinc-900">R$ 0</span>
          <span className="text-sm font-semibold text-zinc-600">/ingresso</span>
        </div>
        <ul className="mt-8 space-y-3">
          <Feature>Eventos ilimitados</Feature>
          <Feature>Ingressos gratuitos ilimitados</Feature>
          <Feature>QR Code na entrada</Feature>
        </ul>
        {!compact ? (
          <div className="mt-8">
            <Link href={CRIAR_CONTA_HREF} prefetch scroll={false} className="btn-outline w-full inline-block text-center">
              Criar conta grátis
            </Link>
          </div>
        ) : null}
      </div>

      <div className="card-interactive h-full rounded-2xl border border-emerald-600 bg-white p-8 shadow-md ring-1 ring-emerald-600">
        <h3 className="text-xl font-semibold text-emerald-700">Eventos pagos</h3>
        <p className="mt-2 text-sm text-zinc-500">Shows, festas e produções profissionais.</p>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-1">
          <span className="text-4xl font-bold text-zinc-900">
            {formatPercentual(TARIFA_PADRAO.percentual)}
          </span>
          <span className="text-sm font-semibold text-zinc-600">
            + {formatBrl(TARIFA_PADRAO.fixoPorIngresso)} /ingresso
          </span>
        </div>
        <ul className="mt-8 space-y-3">
          <Feature>PIX, cartão e pagamento seguro</Feature>
          <Feature>Reembolso automatizado</Feature>
          <Feature>Recebimento direto na conta</Feature>
        </ul>
        {!compact ? (
          <div className="mt-8">
            <Link href={CRIAR_CONTA_HREF} prefetch scroll={false} className="btn-success w-full inline-block text-center text-white">
              Começar a vender
            </Link>
          </div>
        ) : null}
      </div>

      <div className="card-interactive h-full rounded-2xl border border-emerald-800 bg-gradient-to-b from-emerald-50/80 to-white p-8 shadow-md ring-2 ring-emerald-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Mais lucro</p>
        <h3 className="mt-1 text-xl font-semibold text-emerald-900">Assinatura mensal</h3>
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold text-zinc-900">{formatBrl(MENSALIDADE_ASSINATURA_MENSAL)}</span>
            <span className="text-sm text-zinc-600">/mês</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-1 border-t border-emerald-200/80 pt-2">
            <span className="text-3xl font-bold text-zinc-900">
              {formatPercentual(TARIFA_ASSINATURA.percentual)}
            </span>
            <span className="text-sm font-semibold text-zinc-600">
              + {formatBrl(TARIFA_ASSINATURA.fixoPorIngresso)} /ingresso
            </span>
          </div>
        </div>
        <ul className="mt-8 space-y-3">
          <Feature>Taxa reduzida em cada venda</Feature>
          <Feature>Mesmos recursos do plano pago</Feature>
          <Feature>Indicado para alto volume</Feature>
        </ul>
        {!compact ? (
          <div className="mt-8">
            <Link href={CRIAR_CONTA_HREF} prefetch scroll={false} className="btn-success w-full inline-block text-center text-white">
              Ver detalhes
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
