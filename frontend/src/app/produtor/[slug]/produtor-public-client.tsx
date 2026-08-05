"use client";

import { useEffect, useState } from "react";
import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import { OrganizerBrandTheme } from "@/components/organizer-brand-theme";
import { apiFetch } from "@/lib/api";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import type { ProdutorPerfilPublico } from "@/lib/produtor-publico";
import { resolveUrlPublicaHref } from "@/lib/url-publica";

type Perfil = ProdutorPerfilPublico;

export function ProdutorPublicClient({
  slug,
  initialPerfil = null,
}: {
  slug: string;
  initialPerfil?: Perfil | null;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(initialPerfil);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initialPerfil && initialPerfil.slug === slug) {
      setPerfil(initialPerfil);
      setErr(null);
      return;
    }
    let cancelled = false;
    void apiFetch<Perfil>(`/api/produtor/${encodeURIComponent(slug)}`)
      .then((p) => {
        if (!cancelled) {
          setPerfil(p);
          setErr(null);
        }
      })
      .catch(() => {
        if (!cancelled) setErr("Produtor não encontrado.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initialPerfil]);

  if (err) return <p className="py-12 text-center text-zinc-600">{err}</p>;
  if (!perfil) return <p className="py-12 text-center text-zinc-500">Carregando…</p>;

  const fotoSrc = resolveEventoImagemSrc(perfil.foto_url || perfil.brand_logo_url);
  const instagramHref = resolveUrlPublicaHref(perfil.social_instagram);
  const whatsappHref = resolveUrlPublicaHref(perfil.social_whatsapp);
  const siteHref = resolveUrlPublicaHref(perfil.social_site);

  return (
    <OrganizerBrandTheme brand={perfil}>
      <div className="mx-auto max-w-6xl py-12 px-4">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {fotoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoSrc}
              alt={`Logo de ${perfil.nome}`}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-[var(--brand-primary,#10b981)]/30"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-800">
              {perfil.nome.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{perfil.nome}</h1>
            {perfil.bio ? <p className="mt-2 max-w-xl text-zinc-600">{perfil.bio}</p> : null}
            {instagramHref || whatsappHref || siteHref ? (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--brand-primary-dark,#047857)] underline-offset-2 hover:underline"
                  >
                    Instagram
                  </a>
                ) : null}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--brand-primary-dark,#047857)] underline-offset-2 hover:underline"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {siteHref ? (
                  <a
                    href={siteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--brand-primary-dark,#047857)] underline-offset-2 hover:underline"
                  >
                    Site
                  </a>
                ) : null}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-zinc-500">
              {perfil.metricas.eventos_publicados} evento(s) publicado(s) · {perfil.metricas.ingressos_pagos}{" "}
              ingresso(s) confirmado(s)
            </p>
          </div>
        </header>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perfil.eventos.map((e) => (
            <EventoCardVitrine key={e.id} evento={e} />
          ))}
        </div>
      </div>
    </OrganizerBrandTheme>
  );
}
