"use client";

import { labelClassificacaoEtaria } from "@/lib/evento-ficha";

type Props = {
  classificacaoEtaria?: string | null;
  oQueLevar?: string | null;
  estacionamento?: string | null;
  className?: string;
};

function IconIdade({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function IconMala({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75V5.25A2.25 2.25 0 0 1 10.5 3h3a2.25 2.25 0 0 1 2.25 2.25v1.5m-10.5 0h13.5A1.5 1.5 0 0 1 20.25 8.25v9A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25v-9A1.5 1.5 0 0 1 5.25 6.75Z"
      />
    </svg>
  );
}

function IconCarro({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.12-1.227l1.26-7.56A2.25 2.25 0 0 1 5.71 8.25h12.58a2.25 2.25 0 0 1 2.195 1.713l1.26 7.56a1.125 1.125 0 0 1-1.12 1.227H18.75m-9 0a1.5 1.5 0 0 1 3 0m-3 0a1.5 1.5 0 0 0 3 0m3.75-9V6.75A2.25 2.25 0 0 0 15.75 4.5h-7.5A2.25 2.25 0 0 0 6 6.75v2.25"
      />
    </svg>
  );
}

/** Ficha técnica na página pública — só itens preenchidos (omite vazios). */
export function EventoFichaTecnica({
  classificacaoEtaria,
  oQueLevar,
  estacionamento,
  className = "",
}: Props) {
  const idade = classificacaoEtaria?.trim() || "";
  const levar = oQueLevar?.trim() || "";
  const park = estacionamento?.trim() || "";
  if (!idade && !levar && !park) return null;

  const itens: { key: string; label: string; valor: string; Icon: typeof IconIdade }[] = [];
  if (idade) {
    itens.push({
      key: "idade",
      label: "Classificação",
      valor: labelClassificacaoEtaria(idade),
      Icon: IconIdade,
    });
  }
  if (levar) {
    itens.push({ key: "levar", label: "O que levar", valor: levar, Icon: IconMala });
  }
  if (park) {
    itens.push({ key: "park", label: "Estacionamento", valor: park, Icon: IconCarro });
  }

  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
      aria-labelledby="ficha-tecnica-titulo"
    >
      <h2 id="ficha-tecnica-titulo" className="text-lg font-semibold text-zinc-900">
        Informações do evento
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {itens.map(({ key, label, valor, Icon }) => (
          <li key={key} className="flex gap-3 rounded-lg bg-zinc-50 px-3 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-zinc-200">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-900">{valor}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
