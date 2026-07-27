"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NovoEventoForm } from "./novo-evento-client";
import { fetchSession, peekSessionCache } from "@/lib/api";
import { authHrefParaCriarEvento } from "@/lib/criar-evento-routes";

export function NovoEventoGate() {
  const router = useRouter();
  const cached = peekSessionCache();
  const [ok, setOk] = useState(cached?.tipo === "organizador");

  useEffect(() => {
    if (ok) return;
    let cancelled = false;
    void (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      if (!u) {
        router.replace(authHrefParaCriarEvento());
        return;
      }
      if (u.tipo !== "organizador") {
        // Cliente com conta existente: manda pro fluxo de virar organizador (card em
        // Perfil), SEM deslogar — antes isso deslogava e mandava criar conta nova,
        // o que não faz sentido agora que dá pra converter a mesma conta.
        router.replace("/conta/perfil?tornar_organizador=1");
        return;
      }
      setOk(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, ok]);

  if (!ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-zinc-600" aria-busy="true">
        <span className="sr-only">Carregando formulário de novo evento…</span>
      </div>
    );
  }

  return <NovoEventoForm variant="standalone" />;
}
