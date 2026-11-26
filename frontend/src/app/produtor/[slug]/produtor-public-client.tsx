"use client";

import { useEffect, useState } from "react";
import { EventoCardVitrine } from "@/components/evento-card-vitrine";
import { OrganizerBrandTheme } from "@/components/organizer-brand-theme";
import { apiFetch } from "@/lib/api";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";
import type { ProdutorPerfilPublico } from "@/lib/produtor-publico";
import { resolveUrlPublicaHref } from "@/lib/url-publica";

type Perfil = ProdutorPerfilPublico;

/** Abaixo disso o número afasta o comprador em vez de convencer. */
const MIN_INGRESSOS_PARA_EXIBIR = 50;

export function ProdutorPublicClient({
  slug,
  initialPerfil = null,
  vitrine = false,
}: {
  slug: string;
  initialPerfil?: Perfil | null;
  vitrine?: boolean;
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
  const capaSrc = resolveEventoImagemSrc(perfil.brand_cover_url);
  const instagramHref = resolveUrlPublicaHref(perfil.social_instagram);
  const whatsappHref = resolveUrlPublicaHref(perfil.social_whatsapp);
  const siteHref = resolveUrlPublicaHref(perfil.social_site);

  const linkMarca = "font-medium text-[var(--brand-primary-dark,#047857)] underline-offset-2 hover:underline";
  const redes =
    instagramHref || whatsappHref || siteHref ? (
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {instagramHref ? (
          <a href={instagramHref} target="_blank" rel="noopener noreferrer" className={linkMarca}>
            Instagram
          </a>
        ) : null}
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={linkMarca}>
            WhatsApp
          </a>
        ) : null}
        {siteHref ? (
          <a href={siteHref} target="_blank" rel="noopener noreferrer" className={linkMarca}>
            Site
          </a>
        ) : null}
      </div>
    ) : null;
  const metricas =
    perfil.metricas.ingressos_pagos >= MIN_INGRESSOS_PARA_EXIBIR ? (
      <p className="mt-3 text-sm text-zinc-500" data-produtor-metricas>
        {perfil.metricas.eventos_publicados} evento(s) publicado(s) · {perfil.metricas.ingressos_pagos}{" "}
        ingressos vendidos
      </p>
    ) : null;
  const avatar = fotoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fotoSrc}
      alt={`Logo de ${perfil.nome}`}
      className={`${vitrine ? "h-16 w-16" : "h-24 w-24"} rounded-full object-cover ring-2 ring-[var(--brand-primary,#10b981)]/30`}
    />
  ) : (
    <div
      className={`flex ${vitrine ? "h-16 w-16 text-xl" : "h-24 w-24 text-2xl"} items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800`}
    >
      {perfil.nome.charAt(0)}
    </div>
  );
  const eventos = (
    <div className={`${vitrine ? "mt-6" : "mt-10"} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
      {perfil.eventos.map((e) => (
        <EventoCardVitrine key={e.id} evento={e} />
      ))}
    </div>
  );
  const capa = capaSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={capaSrc}
      alt={`Capa de ${perfil.nome}`}
      className="mb-8 aspect-[4/1] w-full rounded-2xl object-cover"
      data-produtor-capa
    />
  ) : null;

  if (vitrine) {
    return (
      <OrganizerBrandTheme brand={perfil}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          {capa}
          <header className="flex items-center gap-4">
            {avatar}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{perfil.nome}</h1>
              {metricas}
            </div>
          </header>
          {eventos}
          <ul
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
            data-vitrine-confianca
          >
            <li>🔒 Pagamento seguro</li>
            <li>PIX ou cartão</li>
            <li>Ingresso no e-mail na hora</li>
            <li className="text-xs text-zinc-500">Pagamento processado pela EventosBR</li>
          </ul>
          {perfil.bio || redes ? (
            <section className="mt-12 border-t border-zinc-200 pt-8" aria-labelledby="sobre-produtor" data-vitrine-sobre>
              <h2 id="sobre-produtor" className="text-lg font-semibold text-zinc-900">
                Sobre {perfil.nome}
              </h2>
              {perfil.bio ? <p className="mt-2 max-w-2xl text-zinc-600">{perfil.bio}</p> : null}
              {redes}
            </section>
          ) : null}
        </div>
      </OrganizerBrandTheme>
    );
  }

  return (
    <OrganizerBrandTheme brand={perfil}>
      <div className="mx-auto max-w-6xl py-12 px-4">
        {capa}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {avatar}
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{perfil.nome}</h1>
            {perfil.bio ? <p className="mt-2 max-w-xl text-zinc-600">{perfil.bio}</p> : null}
            {redes}
            {metricas}
          </div>
        </header>
        {eventos}
      </div>
    </OrganizerBrandTheme>
  );
}
