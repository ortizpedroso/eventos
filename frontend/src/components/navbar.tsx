"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { NavbarCategoriasMenu } from "@/components/navbar-categorias-menu";
import { EventosBRLogo } from "@/components/eventosbr-logo";
import { fetchSession, logoutSession, peekSessionCache } from "@/lib/api";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import { hrefCriarEvento } from "@/lib/criar-evento-routes";
import { contarPagamentosPendentes } from "@/lib/pagamentos-pendentes";

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
  const [loggedIn, setLoggedIn] = useState(() => peekSessionCache() != null);
  const [userNome, setUserNome] = useState<string | null>(() => peekSessionCache()?.nome ?? null);
  const [userTipo, setUserTipo] = useState<string | null>(() => peekSessionCache()?.tipo ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [buscaNav, setBuscaNav] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function syncSession() {
      const u = await fetchSession();
      setLoggedIn(Boolean(u));
      setUserNome(u?.nome ?? null);
      setUserTipo(u?.tipo ?? null);
      if (u) {
        const n = await contarPagamentosPendentes();
        setPendentesCount(n);
      } else {
        setPendentesCount(0);
      }
    }
    const onSync = () => void syncSession();
    void syncSession();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, onSync);
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const logout = useCallback(() => {
    void logoutSession().finally(() => {
      setLoggedIn(false);
      setUserNome(null);
      setUserTipo(null);
      setMenuOpen(false);
      setMobileNavOpen(false);
      router.push("/");
      router.refresh();
    });
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
  /** Enquanto /me carrega ou usuário é cliente: só Eventos, Pagamentos, Ingressos na barra */
  const navClienteOuCarregando = loggedIn && (userTipo === null || userTipo === "cliente");

  const mobileLink =
    "block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-emerald-50 hover:text-emerald-950";

  function navLinkClass(href: string) {
    const ativo = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
    return ativo
      ? "shrink-0 font-semibold text-emerald-900 underline-offset-2 hover:underline"
      : "shrink-0 transition-colors hover:text-zinc-900";
  }

  function pagamentosLabel() {
    if (pendentesCount <= 0) return "Pagamentos";
    return `Pagamentos (${pendentesCount})`;
  }

  function submitBusca(e: React.FormEvent) {
    e.preventDefault();
    const q = buscaNav.trim();
    router.push(q ? `/eventos?q=${encodeURIComponent(q)}` : "/eventos");
    setMobileNavOpen(false);
  }

  function PagamentosNavLink({
    href,
    className,
    onClick,
  }: {
    href: string;
    className: string;
    onClick?: () => void;
  }) {
    return (
      <Link href={href} className={`relative inline-flex items-center gap-1.5 ${className}`} onClick={onClick}>
        {pagamentosLabel()}
        {pendentesCount > 0 ? (
          <span
            className="absolute -right-2 -top-1 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            aria-label={`${pendentesCount} pagamento(s) pendente(s)`}
          />
        ) : null}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      {/* flex-col: menu móvel em linha própria; linha de cima sem flex-wrap para o ícone não “saltar” de linha */}
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6 lg:gap-10">
            <EventosBRLogo className="shrink-0" />

          <form onSubmit={submitBusca} className="hidden min-w-0 flex-1 max-w-xs lg:max-w-sm md:block" role="search">
            <label htmlFor="nav-busca" className="sr-only">Buscar eventos</label>
            <input
              id="nav-busca"
              type="search"
              placeholder="Buscar eventos…"
              value={buscaNav}
              onChange={(e) => setBuscaNav(e.target.value)}
              className="input w-full py-2 text-sm"
            />
          </form>

          <nav
            className="hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-zinc-600 md:flex lg:gap-x-6"
            aria-label="Principal (ambiente de trabalho)"
          >
            {navClienteOuCarregando ? (
              <>
                <Link href="/eventos" className={navLinkClass("/eventos")}>
                  Eventos
                </Link>
                <NavbarCategoriasMenu compact />
                <PagamentosNavLink href="/conta/pagamentos" className={navLinkClass("/conta/pagamentos")} />
                <Link href="/conta/ingressos" className={navLinkClass("/conta/ingressos")}>
                  Ingressos
                </Link>
              </>
            ) : isOrganizador ? (
              <>
                <Link href="/organizador/eventos" className={navLinkClass("/organizador")}>
                  Painel
                </Link>
                <PagamentosNavLink href="/conta/pagamentos" className={navLinkClass("/conta/pagamentos")} />
                <Link href="/conta/ingressos" className={navLinkClass("/conta/ingressos")}>
                  Ingressos
                </Link>
                <Link href="/funcionalidades" className={navLinkClass("/funcionalidades")}>
                  Funcionalidades
                </Link>
                <Link href="/planos" className={navLinkClass("/planos")}>
                  Planos
                </Link>
                <Link href="/eventos" className={navLinkClass("/eventos")}>
                  Eventos
                </Link>
                <NavbarCategoriasMenu compact />
                <Link href="/sobre" className={navLinkClass("/sobre")}>
                  Sobre
                </Link>
              </>
            ) : (
              <>
                <Link href="/funcionalidades" className={navLinkClass("/funcionalidades")}>
                  Funcionalidades
                </Link>
                <Link href="/planos" className={navLinkClass("/planos")}>
                  Planos
                </Link>
                <Link href="/eventos" className={navLinkClass("/eventos")}>
                  Eventos
                </Link>
                <NavbarCategoriasMenu compact />
                <Link href="/sobre" className={navLinkClass("/sobre")}>
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
            <form onSubmit={submitBusca} className="px-3 pb-2" role="search">
              <input
                type="search"
                placeholder="Buscar eventos…"
                value={buscaNav}
                onChange={(e) => setBuscaNav(e.target.value)}
                className="input w-full text-sm"
                aria-label="Buscar eventos"
              />
            </form>
            {navClienteOuCarregando ? (
              <div className="flex flex-col gap-0.5">
                <Link href="/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Eventos
                </Link>
                <NavbarCategoriasMenu onNavigate={() => setMobileNavOpen(false)} />
                <PagamentosNavLink
                  href="/conta/pagamentos"
                  className={mobileLink}
                  onClick={() => setMobileNavOpen(false)}
                />
                <Link href="/conta/ingressos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Ingressos
                </Link>
              </div>
            ) : isOrganizador ? (
              <div className="flex flex-col gap-0.5">
                <Link href="/organizador/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Painel — Meus eventos
                </Link>
                <PagamentosNavLink
                  href="/conta/pagamentos"
                  className={mobileLink}
                  onClick={() => setMobileNavOpen(false)}
                />
                <Link href="/conta/ingressos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Ingressos
                </Link>
                <Link href="/funcionalidades" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Funcionalidades
                </Link>
                <Link href="/planos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Planos
                </Link>
                <Link href="/eventos" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Eventos
                </Link>
                <NavbarCategoriasMenu onNavigate={() => setMobileNavOpen(false)} />
                <Link href="/sobre" className={mobileLink} onClick={() => setMobileNavOpen(false)}>
                  Sobre
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
                <NavbarCategoriasMenu onNavigate={() => setMobileNavOpen(false)} />
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
