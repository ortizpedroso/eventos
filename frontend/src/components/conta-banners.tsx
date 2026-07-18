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
  const [precisaCpfCnpj, setPrecisaCpfCnpj] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [docErro, setDocErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
      setSemSenha(u.tem_senha === false);
      setEmailPendente(u.email_verificado === false);
      setPrecisaCpfCnpj(u.precisa_cpf_cnpj === true);
    } catch {
      setSemSenha(false);
      setEmailPendente(false);
      setPrecisaCpfCnpj(false);
    }
  }, []);

  async function salvarDocumento() {
    const doc = cpfCnpj.replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) {
      setDocErro("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    setSalvandoDoc(true);
    setDocErro(null);
    try {
      await apiFetch("/api/organizador/documento", {
        method: "PUT",
        body: JSON.stringify({ cpf_cnpj: doc }),
      });
      setPrecisaCpfCnpj(false);
    } catch (e) {
      setDocErro(e instanceof Error ? e.message : "Não foi possível salvar o documento.");
    } finally {
      setSalvandoDoc(false);
    }
  }

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

  if (!semSenha && !emailPendente && !precisaCpfCnpj) return null;

  const perfilHref = pathname.startsWith("/organizador") ? "/organizador/perfil" : "/conta/perfil";

  return (
    <div className="mb-4 space-y-3">
      {precisaCpfCnpj ? (
        <div
          className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-950"
          role="status"
        >
          <p className="font-semibold">Complete seu cadastro</p>
          <p className="mt-1 text-indigo-900">
            Informe seu CPF ou CNPJ para receber repasses e contratar a assinatura EventosBR.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              inputMode="numeric"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="Somente números"
              aria-label="CPF ou CNPJ"
              className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-950 sm:max-w-xs"
            />
            <button
              type="button"
              disabled={salvandoDoc}
              onClick={() => void salvarDocumento()}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {salvandoDoc ? "Salvando…" : "Salvar"}
            </button>
          </div>
          {docErro ? <p className="mt-2 text-xs text-red-700">{docErro}</p> : null}
        </div>
      ) : null}

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
