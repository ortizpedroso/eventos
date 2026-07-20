"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { Usuario } from "@/lib/types";

export function ContaBanners() {
  const pathname = usePathname();
  const [semSenha, setSemSenha] = useState(false);
  const [emailPendente, setEmailPendente] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
      setSemSenha(u.tem_senha === false);
      setEmailPendente(u.email_verificado === false);
    } catch {
      setSemSenha(false);
      setEmailPendente(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [pathname, carregar]);

  async function reenviarEmail() {
    setReenviando(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ message: string; dev_link?: string }>(
        "/api/auth/reenviar-verificacao-email",
        { method: "POST" },
      );
      setMsg(r.dev_link ? `${r.message} Link dev: ${r.dev_link}` : r.message);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível reenviar.");
    } finally {
      setReenviando(false);
    }
  }

  if (!semSenha && !emailPendente) return null;

  const perfilHref = "/conta/perfil";

  return (
    <div className="mb-4 space-y-3">
      {emailPendente ? (
        <div
          className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
          role="status"
        >
          <p className="font-semibold">Confirme seu e-mail</p>
          <p className="mt-1 text-sky-900">
            Enviamos um link de confirmação. Isso protege seus ingressos e permite recuperar a conta.
          </p>
          <button
            type="button"
            disabled={reenviando}
            onClick={() => void reenviarEmail()}
            className="mt-2 text-sm font-medium text-sky-950 underline underline-offset-2 disabled:opacity-60"
          >
            {reenviando ? "Enviando…" : "Reenviar e-mail de confirmação"}
          </button>
          {msg ? <p className="mt-2 text-xs text-sky-800">{msg}</p> : null}
        </div>
      ) : null}

      {semSenha ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold">Proteja sua conta</p>
          <p className="mt-1 text-amber-900">
            Sua conta foi criada na compra rápida sem senha. Defina uma senha no perfil para acessar com
            segurança em outros dispositivos.
          </p>
          <Link
            href={perfilHref}
            className="mt-2 inline-flex text-sm font-medium text-amber-950 underline underline-offset-2"
          >
            Definir senha agora →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
