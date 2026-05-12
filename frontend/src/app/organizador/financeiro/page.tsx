import Link from "next/link";

export default function OrganizadorFinanceiroPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Financeiro</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
        O repasse dos ingressos segue as regras da sua conta conectada no Stripe. Aqui você encontra
        atalhos para acompanhar o que já foi pago pelos participantes.
      </p>
      <ul className="mt-8 space-y-3 text-sm">
        <li>
          <Link
            href="/conta/pagamentos"
            className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-3 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 transition hover:bg-emerald-50"
          >
            Ver pagamentos e ingressos vendidos →
          </Link>
        </li>
        <li>
          <Link
            href="/organizador/relatorios"
            className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-3 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 transition hover:bg-emerald-50"
          >
            Relatórios com gráficos e lista em CSV →
          </Link>
        </li>
        <li>
          <Link
            href="/planos"
            className="inline-flex rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            Planos e taxas da plataforma →
          </Link>
        </li>
      </ul>
    </div>
  );
}
