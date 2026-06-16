"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";

export function VerificarEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("Link inválido. Abra o endereço completo enviado por e-mail.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      try {
        const r = await apiFetch<{ message: string }>("/api/auth/verificar-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) {
          setStatus("ok");
          setMessage(r.message);
          dispatchAuthSync();
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setMessage(e instanceof Error ? e.message : "Não foi possível confirmar o e-mail.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-zinc-900">Confirmar e-mail</h1>
      {status === "loading" ? (
        <p className="mt-4 text-sm text-zinc-600" role="status">
          Validando seu link…
        </p>
      ) : null}
      {status === "ok" ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/conta/ingressos" className="btn-success px-4 py-2 text-sm">
              Meus ingressos
            </Link>
            <Link href="/eventos" className="text-sm font-medium text-emerald-800 underline">
              Explorar eventos
            </Link>
          </div>
        </div>
      ) : null}
      {status === "err" ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </p>
          <Link href="/conta/perfil" className="text-sm font-medium text-emerald-800 underline">
            Ir ao perfil para reenviar confirmação
          </Link>
        </div>
      ) : null}
    </div>
  );
}
