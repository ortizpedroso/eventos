"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { TokenResponse } from "@/lib/types";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID?.trim() ?? "";

type OAuthLoginButtonsProps = {
  mode: "login" | "register";
  tipoRegistro: string;
  aceitaComEmail: boolean;
  aceitaComWhatsapp: boolean;
  telefoneCadastro: string;
  disabled?: boolean;
  onSuccess: (data: TokenResponse) => void;
  onError: (message: string) => void;
};

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.id = id;
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(el);
  });
}

export function OAuthLoginButtons({
  mode,
  tipoRegistro,
  aceitaComEmail,
  aceitaComWhatsapp,
  telefoneCadastro,
  disabled,
  onSuccess,
  onError,
}: OAuthLoginButtonsProps) {
  const googleRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  const oauthBody = useCallback(
    () => ({
      tipo: tipoRegistro,
      aceita_comunicacao_email: aceitaComEmail,
      aceita_comunicacao_whatsapp: aceitaComWhatsapp,
      telefone:
        aceitaComWhatsapp && telefoneCadastro.replace(/\D/g, "").length >= 10
          ? telefoneCadastro.replace(/\D/g, "")
          : null,
    }),
    [tipoRegistro, aceitaComEmail, aceitaComWhatsapp, telefoneCadastro],
  );

  const postOAuth = useCallback(
    async (provider: "google" | "apple", idToken: string) => {
      setBusy(provider);
      try {
        const data = await apiFetch<TokenResponse>(`/api/auth/${provider}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id_token: idToken, ...oauthBody() }),
        });
        onSuccess(data);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Erro no login social");
      } finally {
        setBusy(null);
      }
    },
    [oauthBody, onSuccess, onError],
  );

  const handleGoogleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      const token = response.credential?.trim();
      if (!token) {
        onError("Google não devolveu credencial.");
        return;
      }
      void postOAuth("google", token);
    },
    [postOAuth, onError],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadScript("https://accounts.google.com/gsi/client", "google-gsi");
        if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: mode === "register" ? "signup_with" : "signin_with",
          locale: "pt-BR",
        });
        if (!cancelled) setGoogleReady(true);
      } catch {
        if (!cancelled) onError("Não foi possível carregar o login Google.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential, mode, onError]);

  useEffect(() => {
    if (!APPLE_CLIENT_ID) return;
    let cancelled = false;

    const onAppleSuccess = (event: Event) => {
      const detail = (event as CustomEvent<{ authorization?: { id_token?: string } }>).detail;
      const token = detail?.authorization?.id_token?.trim();
      if (token) void postOAuth("apple", token);
      else onError("Apple não devolveu token.");
    };

    const onAppleFailure = (event: Event) => {
      const err = (event as CustomEvent<{ error?: string }>).detail?.error;
      if (err && err !== "popup_closed_by_user") {
        onError(`Login Apple falhou: ${err}`);
      }
    };

    void (async () => {
      try {
        await loadScript(
          "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_BR/appleid.auth.js",
          "apple-auth-js",
        );
        if (cancelled || !window.AppleID?.auth) return;
        window.AppleID.auth.init({
          clientId: APPLE_CLIENT_ID,
          scope: "name email",
          redirectURI: typeof window !== "undefined" ? `${window.location.origin}/auth` : "",
          usePopup: true,
        });
        document.addEventListener("AppleIDSignInOnSuccess", onAppleSuccess);
        document.addEventListener("AppleIDSignInOnFailure", onAppleFailure);
        if (!cancelled) setAppleReady(true);
      } catch {
        if (!cancelled) onError("Não foi possível carregar o login Apple.");
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("AppleIDSignInOnSuccess", onAppleSuccess);
      document.removeEventListener("AppleIDSignInOnFailure", onAppleFailure);
    };
  }, [postOAuth, onError]);

  async function signInApple() {
    if (!window.AppleID?.auth) {
      onError("Login Apple indisponível.");
      return;
    }
    setBusy("apple");
    try {
      const res = await window.AppleID.auth.signIn();
      const token = res.authorization?.id_token?.trim();
      if (token) await postOAuth("apple", token);
      else onError("Apple não devolveu token.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("popup_closed")) onError(msg || "Login Apple cancelado.");
    } finally {
      setBusy(null);
    }
  }

  if (!GOOGLE_CLIENT_ID && !APPLE_CLIENT_ID) {
    return null;
  }

  const isDisabled = disabled || busy !== null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-500">ou continue com</span>
        </div>
      </div>

      {GOOGLE_CLIENT_ID ? (
        <div
          ref={googleRef}
          className={`flex min-h-[44px] justify-center ${isDisabled ? "pointer-events-none opacity-50" : ""}`}
          aria-hidden={!googleReady}
        />
      ) : null}

      {APPLE_CLIENT_ID ? (
        <button
          type="button"
          disabled={isDisabled || !appleReady}
          onClick={() => void signInApple()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          {busy === "apple" ? "Aguarde..." : "Continuar com Apple"}
        </button>
      ) : null}
    </div>
  );
}
