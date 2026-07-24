"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";

import { fetchSession } from "@/lib/api";
import { AUTH_SYNC_EVENT } from "@/lib/auth-sync";
import {
  authHrefPrecisaContaOrganizador,
  authHrefRegisterOrganizadorParaCriarEvento,
  hrefCriarEvento,
} from "@/lib/criar-evento-routes";

type Props = Omit<ComponentProps<typeof Link>, "href">;

/** Link client-side para criar evento — href estável até confirmar sessão de organizador. */
export function CriarEventoLink(props: Props) {
  const [href, setHref] = useState(authHrefRegisterOrganizadorParaCriarEvento());

  useEffect(() => {
    async function sync() {
      const u = await fetchSession();
      if (u?.tipo === "organizador") {
        setHref(hrefCriarEvento);
      } else if (u?.tipo === "cliente") {
        setHref(authHrefPrecisaContaOrganizador());
      } else {
        setHref(authHrefRegisterOrganizadorParaCriarEvento());
      }
    }
    const onSync = () => void sync();
    void sync();
    window.addEventListener(AUTH_SYNC_EVENT, onSync);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, onSync);
  }, []);

  return <Link href={href} prefetch scroll={false} {...props} />;
}
