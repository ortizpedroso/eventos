"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { TokenResponse } from "@/lib/types";

type OAuthConfig = {
  google_enabled: boolean;
  google_client_id: string;
};

const ENV_GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

const MSG_NAO_CONFIGURADO =
  "Login com Google ainda não configurado. Defina GOOGLE_OAUTH_CLIENT_ID no .env da API e reinicie.";

type OAuthLoginButtonsProps = {
  mode: "login" | "register";
  tipoRegistro: string;
  aceitaComEmail: boolean;
  aceitaComWhatsapp: boolean;
  telefoneCadastro: string;
  disabled?: boolean;
  /** checkout: sem divisor «ou continue com» */
  variant?: "default" | "checkout";
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

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function OAuthLoginButtons({
  mode,
  tipoRegistro,
  aceitaComEmail,
  aceitaComWhatsapp,
  telefoneCadastro,
  disabled,
  variant = "default",
  onSuccess,
  onError,
}: OAuthLoginButtonsProps) {
  const googleRef = useRef<HTMLDivElement>(null);
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const googleClientId = ENV_GOOGLE || oauthConfig?.google_client_id?.trim() || "";
  const googleEnabled = Boolean(googleClientId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await apiFetch<OAuthConfig>("/api/auth/oauth-config");
        if (!cancelled) setOauthConfig(cfg);
      } catch {
        if (!cancelled) setOauthConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const postGoogle = useCallback(
    async (idToken: string) => {
      setBusy(true);
      try {
        const data = await apiFetch<TokenResponse>("/api/auth/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id_token: idToken, ...oauthBody() }),
        });
        onSuccess(data);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Erro no login social");
      } finally {
        setBusy(false);
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
      void postGoogle(token);
    },
    [postGoogle, onError],
  );

  useEffect(() => {
    if (!googleEnabled || !googleRef.current) {
      setGoogleReady(false);
      return;
    }
    let cancelled = false;
    setGoogleReady(false);

    void (async () => {
      try {
        await loadScript("https://accounts.google.com/gsi/client", "google-gsi");
        if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        googleRef.current.replaceChildren();
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
  }, [googleClientId, googleEnabled, handleGoogleCredential, mode, onError]);

  const isDisabled = disabled || busy;
  const googleLabel = mode === "register" ? "Cadastrar com Google" : "Continuar com Google";

  return (
    <div className="space-y-3">
      {variant === "default" ? (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-zinc-500">ou continue com</span>
          </div>
        </div>
      ) : null}

      {googleEnabled ? (
        <div
          ref={googleRef}
          className={`flex min-h-[44px] justify-center ${isDisabled ? "pointer-events-none opacity-50" : ""}`}
          aria-hidden={!googleReady}
        />
      ) : (
        <button
          type="button"
          disabled={isDisabled}
          title={MSG_NAO_CONFIGURADO}
          onClick={() => onError(MSG_NAO_CONFIGURADO)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLabel}
        </button>
      )}
    </div>
  );
}
