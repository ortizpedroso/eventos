"use client";

import { Suspense, useState } from "react";

import { PerfilClient } from "@/app/conta/perfil/perfil-client";
import { PagamentosClient } from "@/app/conta/pagamentos/pagamentos-client";
import { IngressosClient } from "@/app/conta/ingressos/ingressos-client";
import { NotificacoesClient } from "@/app/conta/notificacoes/notificacoes-client";

type Secao = "perfil" | "pagamentos" | "ingressos" | "notificacoes";

const SECOES: { id: Secao; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "ingressos", label: "Ingressos" },
  { id: "notificacoes", label: "Notificações" },
];

export default function OrganizadorPerfilPage() {
  const [secao, setSecao] = useState<Secao>("perfil");

  function trocarSecao(s: Secao) {
    setSecao(s);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-4">
        {SECOES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => trocarSecao(s.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              secao === s.id
                ? "bg-emerald-700 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {secao === "perfil" && <PerfilClient />}

      {secao === "pagamentos" && (
        <Suspense fallback={<div className="text-sm text-zinc-600">Carregando pagamentos…</div>}>
          <PagamentosClient />
        </Suspense>
      )}

      {secao === "ingressos" && <IngressosClient />}

      {secao === "notificacoes" && <NotificacoesClient />}
    </div>
  );
}
