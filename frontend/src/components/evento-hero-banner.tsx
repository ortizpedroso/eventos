"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

import { EventoCategoriaBadge } from "@/components/evento-categoria-badge";
import { isOptimizableImageHost } from "@/lib/evento-imagem-url";

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

function IconTicket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h12a2.25 2.25 0 0 1 2.25 2.25v2.25a1.5 1.5 0 0 0 0 3v2.25A2.25 2.25 0 0 1 18 16.5H6a2.25 2.25 0 0 1-2.25-2.25v-2.25a1.5 1.5 0 0 0 0-3V6.75Z"
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
  const otimizavel = isOptimizableImageHost(imagemUrl);

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
      className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
      aria-label="Resumo do evento"
    >
      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-stretch">
        <div className="relative aspect-video w-full bg-zinc-100 lg:aspect-auto lg:order-2">
          {otimizavel ? (
            <Image
              src={imagemUrl}
              alt={nome}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- host externo arbitrário, fora do remotePatterns
            <img src={imagemUrl} alt={nome} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>

        <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-8 lg:order-1 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <EventoCategoriaBadge categoria={categoria} variant="card" className="text-xs" />
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl lg:text-4xl">
            {nome}
          </h1>
          <div className="flex flex-col gap-2.5 text-sm text-zinc-700 sm:text-base">
            <p className="flex items-start gap-2.5">
              <IconCalendar className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <span>
                <span className="font-medium text-zinc-900">Início:</span> {fmtInicio}
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <span>
                <span className="font-medium text-zinc-900">Local:</span> {local}
              </span>
            </p>
          </div>

          <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 w-fit">
            <IconTicket className="h-5 w-5 shrink-0 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900 sm:text-base">A partir de {precoFmt}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a
              href="#comprar"
              className="btn-success px-6 py-2.5 text-sm sm:text-base"
            >
              Comprar ingresso
            </a>
            <button
              type="button"
              onClick={() => void compartilhar()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <IconShare className="h-4 w-4" />
              Compartilhar
            </button>
          </div>
          {shareHint ? (
            <p className="text-xs text-zinc-500" role="status">
              {shareHint}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
