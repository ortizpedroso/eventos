"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";

import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import { apiFetch } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
import { mapCheckoutError } from "@/lib/checkout-errors";
import type { TokenResponse } from "@/lib/types";

type Props = {
  authLoginHref: string;
  authRegisterHref: string;
  onAuthenticated: () => void;
};

export function CheckoutAuthPanel({ authLoginHref, authRegisterHref, onAuthenticated }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const onOAuthSuccess = useCallback(
    (_data: TokenResponse) => {
      dispatchAuthSync();
      setSucesso("Conta conectada! Pode continuar a compra abaixo.");
      setErro(null);
      onAuthenticated();
    },
    [onAuthenticated],
  );

  const onOAuthError = useCallback((m: string) => {
    setErro(mapCheckoutError(m));
  }, []);

  async function compraRapida(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    const em = email.trim();
    if (!n || !em) {
      setErro("Informe nome e e-mail para a compra rápida.");
      return;
    }
    setBusy(true);
    setErro(null);
    setSucesso(null);
    try {
      await apiFetch<TokenResponse>("/api/auth/compra-rapida", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: n, email: em }),
      });
      dispatchAuthSync();
      setSucesso("Pronto! Sua conta foi criada — continue para o pagamento.");
      onAuthenticated();
    } catch (err) {
      setErro(mapCheckoutError(err instanceof Error ? err.message : "Não foi possível continuar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sm shadow-sm">
      <p className="font-semibold text-sky-950">Para comprar, identifique-se</p>
      <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
        Leva cerca de 1 minuto. Você permanece neste evento — sem perder o ingresso.
      </p>

      <div className="mt-4">
        <OAuthLoginButtons
          mode="register"
          tipoRegistro="cliente"
          aceitaComEmail={false}
          aceitaComWhatsapp={false}
          telefoneCadastro=""
          disabled={busy}
          variant="checkout"
          onSuccess={onOAuthSuccess}
          onError={onOAuthError}
        />
      </div>

      <form onSubmit={(e) => void compraRapida(e)} className="mt-4 space-y-3 border-t border-sky-200/80 pt-4">
        <p className="text-xs font-medium text-sky-950">Compra rápida (sem senha agora)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            className="rounded-md border border-sky-200 bg-white px-2.5 py-2 text-sm"
            maxLength={200}
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="rounded-md border border-sky-200 bg-white px-2.5 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-sky-800 px-3 py-2.5 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-60"
        >
          {busy ? "A criar conta…" : "Continuar como convidado"}
        </button>
        <p className="text-[11px] leading-relaxed text-sky-900/80">
          Criamos uma conta de cliente com este e-mail. Depois você pode definir senha em Perfil ou
          entrar com Google.
        </p>
      </form>

      <p className="mt-3 text-center text-xs text-sky-900">
        Já tem conta?{" "}
        <Link href={authLoginHref} className="font-semibold underline">
          Entrar
        </Link>
        {" · "}
        <Link href={authRegisterHref} className="font-semibold underline">
          Cadastro completo
        </Link>
      </p>

      {erro ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p className="mt-3 text-xs text-emerald-800" role="status">
          {sucesso}
        </p>
      ) : null}
    </div>
  );
}
