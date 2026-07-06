"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EventoCategoriaIcon } from "@/components/evento-categoria-icon";
import {
  EVENTO_CATEGORIAS_NAV,
  urlEventosPorCategoria,
} from "@/lib/evento-categorias";

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

type Props = {
  /** Estilo compacto para barra desktop. */
  compact?: boolean;
  /** Callback ao escolher link (ex.: fechar menu mobile). */
  onNavigate?: () => void;
};

export function NavbarCategoriasMenu({ compact = false, onNavigate }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const emEventos = pathname === "/eventos" || pathname.startsWith("/eventos/");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!compact) {
    return (
      <div className="border-t border-zinc-100 pt-3">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Explorar categorias
        </p>
        <div className="mt-2 flex flex-col gap-0.5">
          {EVENTO_CATEGORIAS_NAV.map((cat) => (
            <Link
              key={cat}
              href={urlEventosPorCategoria(cat)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-50 hover:text-emerald-950"
              onClick={onNavigate}
            >
              <EventoCategoriaIcon categoria={cat} className="h-4 w-4 text-zinc-500" />
              {cat}
            </Link>
          ))}
          <Link
            href="/eventos"
            className="mt-1 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            onClick={onNavigate}
          >
            Ver todos os eventos →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`inline-flex shrink-0 items-center gap-1 transition-colors hover:text-zinc-900 ${
          emEventos ? "font-semibold text-emerald-900" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Explorar eventos por categoria"
        onClick={() => setOpen((o) => !o)}
      >
        Explorar
        <IconChevron className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-[60] mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {EVENTO_CATEGORIAS_NAV.map((cat) => (
            <Link
              key={cat}
              href={urlEventosPorCategoria(cat)}
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              <EventoCategoriaIcon categoria={cat} className="h-4 w-4 text-zinc-500" />
              {cat}
            </Link>
          ))}
          <div className="my-1 border-t border-zinc-100" aria-hidden />
          <Link
            href="/eventos"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            Ver todos →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
