"use client";

import { Suspense, useState } from "react";

import { PerfilClient } from "@/app/conta/perfil/perfil-client";
import { PagamentosClient } from "@/app/conta/pagamentos/pagamentos-client";
import MeusIngressosPage from "@/app/conta/ingressos/page";
import { NotificacoesClient } from "@/app/conta/notificacoes/notificacoes-client";

type Secao = "perfil" | "pagamentos" | "ingressos" | "notificacoes";

const botoes: { id: Secao; label: string }[] = [
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
      <div className="flex flex-wrap gap-2">
        {botoes.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => trocarSecao(b.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              secao === b.id
                ? "bg-emerald-700 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {secao === "perfil" && <PerfilClient />}

      {secao === "pagamentos" && (
        <Suspense
          fallback={<div className="text-sm text-zinc-600">Carregando pagamentos…</div>}
        >
          <PagamentosClient />
        </Suspense>
      )}

      {secao === "ingressos" && <MeusIngressosPage />}

      {secao === "notificacoes" && <NotificacoesClient />}
    </div>
  );
}
