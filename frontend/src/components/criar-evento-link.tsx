"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";

import { fetchSession, peekSessionCache } from "@/lib/api";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import {
  authHrefPrecisaContaOrganizador,
  authHrefRegisterOrganizadorParaCriarEvento,
  hrefCriarEvento,
} from "@/lib/criar-evento-routes";

function resolveCriarEventoHref(tipo: string | null | undefined, loggedIn: boolean): string {
  if (loggedIn && tipo === "organizador") return hrefCriarEvento;
  if (loggedIn && tipo === "cliente") return authHrefPrecisaContaOrganizador();
  return authHrefRegisterOrganizadorParaCriarEvento();
}

type Props = Omit<ComponentProps<typeof Link>, "href">;

/** Link client-side para criar evento — evita reload e redirect duplo via middleware. */
export function CriarEventoLink(props: Props) {
  const cached = peekSessionCache();
  const [href, setHref] = useState(() => resolveCriarEventoHref(cached?.tipo, cached != null));

  useEffect(() => {
    async function sync() {
      const u = await fetchSession();
      setHref(resolveCriarEventoHref(u?.tipo, Boolean(u)));
    }
    const onSync = () => void sync();
    void sync();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, onSync);
  }, []);

  return <Link href={href} prefetch scroll={false} {...props} />;
}
