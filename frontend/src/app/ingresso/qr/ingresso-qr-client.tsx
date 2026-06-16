"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function IngressoQrClient() {
  const params = useSearchParams();
  const codigo = (params.get("c") || "").trim();

  if (!codigo) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Ingresso EventosBR</h1>
        <p className="text-sm text-zinc-600">Link inválido ou incompleto. Abra o ingresso em Minha conta.</p>
        <Link href="/conta/ingressos" className="inline-block text-sm font-medium text-emerald-800 underline">
          Meus ingressos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">EventosBR</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Seu ingresso</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Apresente este código ou o QR na entrada. Cada ingresso só entra uma vez.
        </p>
      </header>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
          Código para digitar na portaria
        </p>
        <p className="mt-3 break-all rounded-lg border border-emerald-200 bg-white px-3 py-3 font-mono text-sm font-semibold text-zinc-900">
          {codigo}
        </p>
      </div>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        Se você é quem valida na entrada, use o link da portaria enviado pelo organizador — a câmera
        desse link lê o QR automaticamente.
      </p>
    </div>
  );
}
