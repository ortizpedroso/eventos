import { EventoCategoriaBadge } from "@/components/evento-categoria-badge";
import { EventoCompartilhar } from "@/components/evento-compartilhar";

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5"
      />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

type Props = {
  nome: string;
  categoria: string;
  fmtInicio: string;
  local: string;
  /** Quando true, mostra CTA e compartilhar (página publicada). */
  mostrarAcoes?: boolean;
  asH1?: boolean;
};

/**
 * Única ficha meta da página: data + local (âncora ao mapa).
 * Preço/lote ficam só na zona de compra.
 */
export function EventoMetaUnica({
  nome,
  categoria,
  fmtInicio,
  local,
  mostrarAcoes = true,
  asH1 = true,
}: Props) {
  const TitleTag = asH1 ? "h1" : "p";

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      aria-label="Resumo do evento"
    >
      <div className="flex flex-wrap items-center gap-2">
        <EventoCategoriaBadge categoria={categoria} variant="card" className="text-xs" />
      </div>
      <TitleTag className="mt-3 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        {nome}
      </TitleTag>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm text-zinc-700 sm:text-base">
        <li className="flex items-start gap-2.5">
          <IconCalendar className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <span>
            <span className="font-medium text-zinc-900">Quando</span>
            <span className="mx-1.5 text-zinc-400" aria-hidden>
              ·
            </span>
            {fmtInicio}
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <span>
            <span className="font-medium text-zinc-900">Onde</span>
            <span className="mx-1.5 text-zinc-400" aria-hidden>
              ·
            </span>
            {local?.trim() ? (
              <a
                href="#mapa"
                className="text-emerald-800 underline-offset-2 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                {local}
              </a>
            ) : (
              <span>Local a confirmar</span>
            )}
          </span>
        </li>
      </ul>
      {mostrarAcoes ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a href="#comprar" className="btn-success inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-sm sm:text-base">
            Comprar ingresso
          </a>
          <EventoCompartilhar nome={nome} />
        </div>
      ) : null}
    </section>
  );
}
