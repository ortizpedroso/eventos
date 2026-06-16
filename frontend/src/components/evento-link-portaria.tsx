"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type LinkPortaria = {
  evento_id: string;
  evento_nome: string;
  token: string;
  url: string;
  token_em?: string | null;
};

function hostEhLocal(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Link para colaboradores usarem no celular (mesma Wi‑Fi).
 * Se o organizador abre o site em localhost, mantém o IP que a API envia (FRONTEND_PUBLIC_URL).
 */
function urlPortariaNoBrowser(link: LinkPortaria): string {
  const lanOrigin = (process.env.NEXT_PUBLIC_LAN_ORIGIN || "").replace(/\/+$/, "");

  if (typeof window === "undefined") {
    if (lanOrigin) {
      try {
        const parsed = new URL(link.url);
        return `${lanOrigin}${parsed.pathname}${parsed.search}`;
      } catch {
        return link.url;
      }
    }
    return link.url;
  }

  try {
    const parsed = new URL(link.url);
    const path = `${parsed.pathname}${parsed.search}`;

    if (!hostEhLocal(parsed.hostname)) {
      return link.url;
    }

    if (lanOrigin) {
      return `${lanOrigin}${path}`;
    }

    if (!hostEhLocal(window.location.hostname)) {
      return `${window.location.origin}${path}`;
    }

    return link.url;
  } catch {
    return link.url;
  }
}

function linkPrecisaAvisoCelular(link: LinkPortaria): boolean {
  if (typeof window === "undefined") return false;
  try {
    const exibido = new URL(urlPortariaNoBrowser(link));
    return hostEhLocal(window.location.hostname) && !hostEhLocal(exibido.hostname);
  } catch {
    return false;
  }
}

function urlWhatsappPortaria(url: string, eventoNome?: string): string {
  const texto = eventoNome
    ? `Validação de ingressos — ${eventoNome}\n\nAbra este link na entrada (mesma Wi‑Fi do organizador):\n${url}`
    : `Validação de ingressos na entrada:\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function EventoLinkPortaria({ eventoId }: { eventoId: string }) {
  const [link, setLink] = useState<LinkPortaria | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const data = await apiFetch<LinkPortaria>(`/api/eventos/id/${eventoId}/link-portaria`);
      setLink(data);
    } catch (e) {
      setLink(null);
      setErro(e instanceof Error ? e.message : "Não foi possível obter o link.");
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function copiar() {
    if (!link) return;
    const url = urlPortariaNoBrowser(link);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  async function regenerar() {
    if (!window.confirm("O link antigo deixa de funcionar. Gerar um novo link da portaria?")) {
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const data = await apiFetch<LinkPortaria>(
        `/api/eventos/id/${eventoId}/link-portaria/regenerar`,
        { method: "POST" },
      );
      setLink(data);
      setCopiado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível regenerar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-xs leading-relaxed text-sky-950">
      <p className="font-semibold text-sky-900">Link da portaria (colaboradores)</p>
      <p className="mt-1 text-sky-900/90">
        Envie para quem valida na entrada. Funciona sem login — câmera, leitor USB ou digitação.
        O link é renovado automaticamente perto da data do evento ou após 90 dias.
      </p>
      {erro ? <p className="mt-2 text-red-800">{erro}</p> : null}
      {link ? (
        <div className="mt-2 space-y-2">
          {(() => {
            const urlBrowser = urlPortariaNoBrowser(link);
            const avisoCelular = linkPrecisaAvisoCelular(link);
            const whatsappHref = urlWhatsappPortaria(urlBrowser, link.evento_nome);
            return (
              <>
                {avisoCelular ? (
                  <p className="text-[11px] text-sky-800">
                    Copie este link com <strong>IP da rede</strong> para abrir no celular (mesma Wi‑Fi).
                    No PC pode continuar usando localhost.
                  </p>
                ) : null}
                <input
                  type="text"
                  readOnly
                  value={urlBrowser}
                  className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-800"
                  onFocus={(e) => e.target.select()}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copiar()}
                    className="rounded-md bg-sky-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-800"
                  >
                    {copiado ? "Copiado!" : "Copiar link"}
                  </button>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-[#25D366] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1ebe57]"
                  >
                    Enviar no WhatsApp
                  </a>
                  <a
                    href={urlBrowser}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100"
                  >
                    Abrir portaria
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void regenerar()}
                    className="rounded-md border border-sky-300 px-2.5 py-1.5 text-xs text-sky-900 hover:bg-sky-100 disabled:opacity-60"
                  >
                    {busy ? "…" : "Novo link"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : !erro ? (
        <p className="mt-2 text-sky-800/80">A carregar link…</p>
      ) : null}
    </div>
  );
}
