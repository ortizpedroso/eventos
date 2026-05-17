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

function IconMenu({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 6.75h16.5" />
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
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
  }, [loggedIn]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    dispatchAuthSync();
    setMenuOpen(false);
    setMobileNavOpen(false);
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
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileNavOpen(false);
      }
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

  const mobileLink =
    "block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-50 hover:text-emerald-950";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      {/* flex-col: menu móvel em linha própria; linha de cima sem flex-wrap para o ícone não “saltar” de linha */}
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6 lg:gap-10">
            <Link
              href="/"
              className="shrink-0 truncate text-lg font-bold tracking-tight text-zinc-900 sm:text-xl"
            >
              EventosBR
            </Link>

          <nav
            className="hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-zinc-600 md:flex lg:gap-x-6"
            aria-label="Principal (ambiente de trabalho)"
          >
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="nav-mobile-menu"
            aria-label={mobileNavOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <IconMenu open={mobileNavOpen} />
          </button>
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
                <span className="hidden max-w-[10rem] truncate sm:inline">{userNome ?? "…"}</span>
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
              className="btn-success shrink-0 whitespace-nowrap px-3 py-2 text-xs shadow-sm sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">Criar</span>
              <span className="hidden sm:inline">Crie um evento</span>
            </Link>
          ) : null}
        </div>
        </div>

        {mobileNavOpen ? (
          <nav
            id="nav-mobile-menu"
            className="w-full border-t border-zinc-200 py-2 md:hidden"
            aria-label="Principal"
          >
            {navClienteOuCarregando ? (
              <div className="flex flex-col gap-0.5">
                <Link href="/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Eventos
                </Link>
                <Link href="/conta/pagamentos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Pagamentos
                </Link>
                <Link href="/conta/ingressos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Ingressos
                </Link>
              </div>
            ) : isOrganizador ? (
              <div className="flex flex-col gap-0.5">
                <Link href="/funcionalidades" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Funcionalidades
                </Link>
                <Link href="/planos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Planos
                </Link>
                <Link href="/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Eventos
                </Link>
                <Link href="/sobre" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Sobre
                </Link>
                <Link href="/organizador/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Painel — Meus eventos
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Link href="/funcionalidades" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Funcionalidades
                </Link>
                <Link href="/planos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Planos
                </Link>
                <Link href="/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Eventos
                </Link>
                <Link href="/sobre" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Sobre
                </Link>
              </div>
            )}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
