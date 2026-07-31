"use client";

import { useCallback, useState } from "react";

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

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m10.253-.486a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  );
}

const btnClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

type Props = {
  nome: string;
  className?: string;
  /** URL completa para compartilhar (ex.: link com ?ref=). Default: URL da página sem ?ref=. */
  shareUrl?: string;
};

/** Remove ?ref= da URL pública (não “roubar” atribuição do promoter no share do visitante). */
export function urlCompartilharSemRef(href: string): string {
  try {
    const u = new URL(href);
    if (!u.searchParams.has("ref")) return href;
    u.searchParams.delete("ref");
    return u.toString();
  } catch {
    return href;
  }
}

/** Compartilhar: WhatsApp, copiar link e Web Share nativo (quando disponível). */
export function EventoCompartilhar({ nome, className = "", shareUrl }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  const pageUrl = useCallback(() => {
    if (shareUrl) return shareUrl;
    if (typeof window === "undefined") return "";
    return urlCompartilharSemRef(window.location.href);
  }, [shareUrl]);

  const copiarLink = useCallback(async () => {
    setHint(null);
    try {
      await navigator.clipboard.writeText(pageUrl());
      setHint("Link copiado.");
    } catch {
      setHint("Não foi possível copiar. Use o endereço da barra do navegador.");
    }
  }, [pageUrl]);

  const whatsapp = useCallback(() => {
    const url = pageUrl();
    const texto = `${nome}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }, [nome, pageUrl]);

  const nativo = useCallback(async () => {
    setHint(null);
    const url = pageUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: nome, text: nome, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setHint("Link copiado.");
    } catch {
      /* usuário cancelou o share — sem mensagem de erro */
    }
  }, [nome, pageUrl]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Compartilhar evento">
        <button type="button" onClick={whatsapp} className={btnClass} aria-label="Compartilhar no WhatsApp">
          <IconWhatsApp className="h-4 w-4 text-[#25D366]" />
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
        <button type="button" onClick={() => void copiarLink()} className={btnClass} aria-label="Copiar link">
          <IconLink className="h-4 w-4 text-zinc-600" />
          <span className="hidden sm:inline">Copiar link</span>
        </button>
        <button type="button" onClick={() => void nativo()} className={btnClass} aria-label="Mais opções de compartilhar">
          <IconShare className="h-4 w-4 text-zinc-600" />
          <span className="hidden sm:inline">Mais</span>
        </button>
      </div>
      {hint ? (
        <p className="mt-2 text-xs text-zinc-500 transition-opacity duration-200" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
