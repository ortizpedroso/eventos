"use client";

import { type RefObject } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";

const SESSION_KEY = "eventosbr_org_cadastro_pendente";

export type OrganizadorCadastroPendenteData = {
  email: string;
  message: string;
};

export function lerOrganizadorCadastroPendente(): OrganizadorCadastroPendenteData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrganizadorCadastroPendenteData;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function salvarOrganizadorCadastroPendente(data: OrganizadorCadastroPendenteData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function limparOrganizadorCadastroPendente() {
  sessionStorage.removeItem(SESSION_KEY);
}

type OrganizadorCadastroPendenteProps = {
  data: OrganizadorCadastroPendenteData;
  infoMsg: string | null;
  error: string | null;
  reenviando: boolean;
  reenviarDesabilitado?: boolean;
  onReenviar: () => void;
  onIrLogin: () => void;
  onToken: (token: string | null) => void;
  turnstileResetRef?: RefObject<(() => void) | null>;
};

/** Tela pública após cadastro de organizador — conta criada, confirme e-mail (sem login). */
export function OrganizadorCadastroPendente({
  data,
  infoMsg,
  error,
  reenviando,
  reenviarDesabilitado = false,
  onReenviar,
  onIrLogin,
  onToken,
  turnstileResetRef,
}: OrganizadorCadastroPendenteProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Conta criada com sucesso</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Falta só confirmar seu e-mail para ativar a conta de organizador. Você ainda não está logado.
        </p>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm sm:p-8" role="status">
        <p className="text-sm font-semibold text-sky-950">Confirme seu e-mail para ativar a conta</p>
        <p className="mt-3 text-sm text-sky-900">{data.message}</p>
        <p className="mt-4 text-sm text-sky-900">
          E-mail cadastrado:
          <span className="mt-1 block text-lg font-semibold text-sky-950">{data.email}</span>
        </p>
        <p className="mt-4 text-xs leading-relaxed text-sky-800">
          Abra o e-mail que enviamos agora. O link vale por <strong>24 horas</strong>. Você pode clicar em
          «Ativar minha conta» ou copiar e colar o link no navegador. Depois da confirmação, faça login com a
          senha que acabou de cadastrar.
        </p>

        {infoMsg ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {infoMsg}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
            {error}
          </div>
        ) : null}

        <div className="mt-5">
          <TurnstileWidget onToken={onToken} resetRef={turnstileResetRef} />
        </div>

        <button
          type="button"
          disabled={reenviando || reenviarDesabilitado}
          onClick={onReenviar}
          className="mt-4 w-full rounded-full border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-950 transition hover:bg-sky-100 disabled:opacity-60"
        >
          {reenviando ? "Enviando…" : "Reenviar e-mail de confirmação"}
        </button>

        <button
          type="button"
          onClick={onIrLogin}
          className="mt-3 w-full text-center text-sm font-medium text-sky-900 underline underline-offset-2"
        >
          Já confirmou? Fazer login
        </button>
      </div>
    </div>
  );
}
