"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { AUTH_SYNC_EVENT, dispatchAuthSync } from "@/lib/auth-sync";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";
import type { Usuario } from "@/lib/types";

const TOKEN_KEY = "eventosbr_token";

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userTipo, setUserTipo] = useState<string | null>(null);

  useEffect(() => {
    function syncFromStorage() {
      const has = Boolean(window.localStorage.getItem(TOKEN_KEY));
      setLoggedIn(has);
      if (!has) setUserTipo(null);
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
      setUserTipo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (!cancelled) setUserTipo(u.tipo);
      } catch {
        if (!cancelled) setUserTipo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn, pathname]);

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    dispatchAuthSync();
    router.push("/");
    router.refresh();
  }

  const hrefNovoEvento =
    loggedIn && userTipo === "organizador" ? "/organizador/novo" : authHrefParaCriarEvento();

  return (
    <nav className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
      <Link className="hover:text-zinc-900" href="/">
        Eventos
      </Link>
      {loggedIn ? (
        <>
          <Link className="hover:text-zinc-900" href="/conta/perfil">
            Perfil
          </Link>
          <Link className="hover:text-zinc-900" href="/conta/pagamentos">
            Pagamentos
          </Link>
          <Link className="hover:text-zinc-900" href="/conta/ingressos">
            Ingressos
          </Link>
          <Link className="hover:text-zinc-900" href={hrefNovoEvento} title="Só contas de organizador publicam eventos">
            Novo evento
          </Link>
          <button type="button" className="hover:text-zinc-900" onClick={logout}>
            Sair
          </button>
        </>
      ) : (
        <Link className="hover:text-zinc-900" href="/auth">
          Entrar
        </Link>
      )}
    </nav>
  );
}
