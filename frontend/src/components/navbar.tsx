"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { AUTH_SYNC_EVENT, dispatchAuthSync } from "@/lib/auth-sync";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import type { Usuario } from "@/lib/types";

const TOKEN_KEY = "eventosbr_token";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userNome, setUserNome] = useState<string | null>(null);
  const [userTipo, setUserTipo] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncFromStorage() {
      const hasToken = Boolean(window.localStorage.getItem(TOKEN_KEY));
      setLoggedIn(hasToken);
      if (!hasToken) {
        setUserNome(null);
        setUserTipo(null);
      }
    }
    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(AUTH_SYNC_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(AUTH_SYNC_EVENT, syncFromStorage);
    };
  }, [pathname]);

  useEffect(() => {
    if (!loggedIn) {
      setUserNome(null);
      setUserTipo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (!cancelled) {
          setUserNome(u.nome);
          setUserTipo(u.tipo);
        }
      } catch {
        if (!cancelled) {
          setUserNome(null);
          setUserTipo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn, pathname]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    dispatchAuthSync();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const isOrganizador = loggedIn && userTipo === "organizador";
  const hrefCriarEvento =
    loggedIn && userTipo === "organizador" ? "/organizador/novo" : authHrefParaCriarEvento();
  /** Enquanto /me carrega ou usuário é cliente: só Eventos, Pagamentos, Ingressos na barra */
  const navClienteOuCarregando = loggedIn && (userTipo === null || userTipo === "cliente");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-10">
          <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-zinc-900">
            EventosBR
          </Link>

          <nav className="hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-zinc-600 md:flex lg:gap-x-6">
            {navClienteOuCarregando ? (
              <>
                <Link href="/eventos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Eventos
                </Link>
                <Link href="/conta/pagamentos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Pagamentos
                </Link>
                <Link href="/conta/ingressos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Ingressos
                </Link>
              </>
            ) : isOrganizador ? (
              <>
                <Link href="/funcionalidades" className="shrink-0 transition-colors hover:text-zinc-900">
                  Funcionalidades
                </Link>
                <Link href="/planos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Planos
                </Link>
                <Link href="/eventos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Eventos
                </Link>
                <Link href="/sobre" className="shrink-0 transition-colors hover:text-zinc-900">
                  Sobre
                </Link>
              </>
            ) : (
              <>
                <Link href="/funcionalidades" className="shrink-0 transition-colors hover:text-zinc-900">
                  Funcionalidades
                </Link>
                <Link href="/planos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Planos
                </Link>
                <Link href="/eventos" className="shrink-0 transition-colors hover:text-zinc-900">
                  Eventos
                </Link>
                <Link href="/sobre" className="shrink-0 transition-colors hover:text-zinc-900">
                  Sobre
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {loggedIn ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex max-w-[min(100vw-8rem,14rem)] items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-2 pr-3 text-left text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Abrir menu da conta"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <UserIcon className="h-5 w-5" />
                </span>
                <span className="truncate">{userNome ?? "…"}</span>
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-[60] mt-2 min-w-[11rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
                >
                  {isOrganizador ? (
                    <>
                      <Link
                        href="/organizador/eventos"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Meus eventos
                      </Link>
                      <Link
                        href="/conta/pagamentos"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Pagamentos
                      </Link>
                      <Link
                        href="/conta/ingressos"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Ingressos
                      </Link>
                      <div className="my-1 border-t border-zinc-100" aria-hidden />
                    </>
                  ) : null}
                  <Link
                    href={isOrganizador ? "/organizador/perfil" : "/conta/perfil"}
                    role="menuitem"
                    className="block px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Perfil
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                    onClick={logout}
                  >
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/auth"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Login
            </Link>
          )}
          {!loggedIn || userTipo !== "cliente" ? (
            <Link
              href={hrefCriarEvento}
              className="btn-success shrink-0 shadow-sm"
            >
              Crie um evento
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
