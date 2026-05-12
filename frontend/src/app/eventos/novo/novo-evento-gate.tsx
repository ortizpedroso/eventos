"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NovoEventoForm } from "./novo-evento-client";
import { apiFetch } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
import {
  authHrefParaCriarEvento,
  authHrefPrecisaContaOrganizador,
} from "@/lib/criar-evento-routes";
import type { Usuario } from "@/lib/types";

const TOKEN_KEY = "eventosbr_token";

export function NovoEventoGate() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.localStorage.getItem(TOKEN_KEY)) {
        router.replace(authHrefParaCriarEvento());
        return;
      }
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (u.tipo !== "organizador") {
          window.localStorage.removeItem(TOKEN_KEY);
          dispatchAuthSync();
          router.replace(authHrefPrecisaContaOrganizador());
          return;
        }
        setOk(true);
      } catch {
        if (!cancelled) router.replace(authHrefParaCriarEvento());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-zinc-600">
        Verificando permissão para criar evento…
      </div>
    );
  }

  return <NovoEventoForm variant="standalone" />;
}
