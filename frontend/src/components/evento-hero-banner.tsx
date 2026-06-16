"use client";

import { useCallback, useState } from "react";

import { EventoCategoriaBadge } from "@/components/evento-categoria-badge";

type Props = {
  nome: string;
  categoria: string;
  imagemUrl: string;
  local: string;
  fmtInicio: string;
  precoFmt: string;
};

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

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-10.5a2.25 2.25 0 1 0-.727 1.213m0 10.5a2.25 2.25 0 1 0 .727-1.213m0 0L21 12m-9-9v.75V12m0-9L3 12"
      />
    </svg>
  );
}

export function EventoHeroBanner({
  nome,
  categoria,
  imagemUrl,
  local,
  fmtInicio,
  precoFmt,
}: Props) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const compartilhar = useCallback(async () => {
    setShareHint(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: nome, text: nome, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareHint("Link copiado para a área de transferência.");
    } catch {
      setShareHint("Não foi possível compartilhar. Copie o endereço da barra do navegador.");
    }
  }, [nome]);

  return (
    <section
      className="relative w-full overflow-hidden bg-zinc-950 text-white"
      aria-label="Resumo do evento"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagemUrl}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-50 blur-3xl saturate-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/80" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="order-1 flex flex-col gap-4 lg:order-1 [&_p]:text-justify">
            <div className="flex flex-wrap items-center gap-2">
              <EventoCategoriaBadge categoria={categoria} variant="hero" />
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{nome}</h1>
            <div className="flex flex-col gap-3 text-sm text-zinc-200 sm:text-base">
              <p className="flex items-start gap-2.5">
                <IconCalendar className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span className="space-y-1">
                  <span className="block">
                    <span className="font-medium text-white">Início:</span> {fmtInicio}
                  </span>
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>
                  <span className="font-medium text-white">Local:</span> {local}
                </span>
              </p>
            </div>
            <p className="text-sm font-semibold text-emerald-300 sm:text-base">Ingresso: {precoFmt}</p>
          </div>

          <div className="order-2 flex flex-col items-center gap-3 lg:order-2 lg:items-end">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-black/20 shadow-2xl ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagemUrl} alt={nome} className="aspect-video w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => void compartilhar()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-md transition hover:bg-zinc-100"
            >
              <IconShare className="h-4 w-4" />
              Compartilhar
            </button>
            {shareHint ? (
              <p className="text-center text-xs text-emerald-100" role="status">
                {shareHint}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
