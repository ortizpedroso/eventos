"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ContaShell } from "@/components/conta-shell";
import { OrganizadorShell } from "@/app/organizador/organizador-shell";
import { fetchSession } from "@/lib/api";

/**
 * /admin/dashboard fica fora das árvores /organizador/* e /conta/* — sem isso, o
 * menu lateral desaparecia ao clicar em "Administração" (bug reportado). Escolhe
 * o shell certo (organizador ou conta) conforme o tipo da conta logada, mantendo
 * o menu visível também dentro do painel admin.
 */
export function AdminShellWrapper({ children }: { children: ReactNode }) {
  const [tipo, setTipo] = useState<string | null | "carregando">("carregando");

  useEffect(() => {
    let cancelado = false;
    void fetchSession().then((u) => {
      if (!cancelado) setTipo(u?.tipo ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (tipo === "carregando") {
    return <div className="min-h-[60vh]" />;
  }

  if (tipo === "organizador") {
    return <OrganizadorShell>{children}</OrganizadorShell>;
  }

  return <ContaShell>{children}</ContaShell>;
}
