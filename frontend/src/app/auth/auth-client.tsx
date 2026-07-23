"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { ComunicacaoMarketingOptIn } from "@/components/comunicacao-marketing-opt-in";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import type { TokenResponse } from "@/lib/types";
import { apiFetch, fetchSession } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
import { readAuthSearchParams, resolveAuthMode } from "@/lib/auth-search-params";
import { hasAuthCookie } from "@/lib/has-auth-cookie";
import { onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";
import {
  authHrefPrecisaContaOrganizador,
  CRIAR_EVENTO_DESTINO,
  destinoPosAuth,
  isSafeInternalNext,
  nextRequerContaOrganizador,
} from "@/lib/criar-evento-routes";

export type AuthClientProps = {
  hasSessionCookie?: boolean;
  resetToken?: string;
  modeParam?: string;
  fluxoOrganizador?: boolean;
  precisaOrganizador?: boolean;
  sessaoExpirada?: boolean;
  tipoParam?: string;
  nextParam?: string;
};

function serverAuthQuery(props: AuthClientProps): string {
  const sp = new URLSearchParams();
  if (props.resetToken) sp.set("reset", props.resetToken);
  if (props.modeParam) sp.set("mode", props.modeParam);
  if (props.fluxoOrganizador) sp.set("fluxo", "organizador");
  if (props.precisaOrganizador) sp.set("precisa", "organizador");
  if (props.sessaoExpirada) sp.set("expirado", "1");
  if (props.tipoParam) sp.set("tipo", props.tipoParam);
  if (props.nextParam) sp.set("next", props.nextParam);
  return sp.toString();
}

export default function AuthClient(serverProps: AuthClientProps) {
  const router = useRouter();
  const { hasSessionCookie = false } = serverProps;

  const params =
    typeof window !== "undefined"
      ? readAuthSearchParams()
      : readAuthSearchParams(serverAuthQuery(serverProps));

  const {
    resetToken,
    fluxoOrganizador,
    precisaOrganizador,
    sessaoExpirada,
    tipoParam,
    nextParam,
  } = params;

  const mode = resolveAuthMode(params);

  const defaultTipoRegistro = useMemo(() => {
    if (tipoParam === "organizador") return "organizador";
    if (fluxoOrganizador || precisaOrganizador) return "organizador";
    return "cliente";
  }, [tipoParam, fluxoOrganizador, precisaOrganizador]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [aguardandoRedirect, setAguardandoRedirect] = useState(false);
  const [aceitaComEmail, setAceitaComEmail] = useState(false);
  const [aceitaComWhatsapp, setAceitaComWhatsapp] = useState(false);
  const [telefoneCadastro, setTelefoneCadastro] = useState("");

  const redirecionar = useCallback(
    (destino: string) => {
      router.replace(destino);
    },
    [router],
  );

  useLayoutEffect(() => {
    if (!hasSessionCookie && !hasAuthCookie()) {
      document.querySelector("form[data-auth-form]")?.setAttribute("data-auth-ready", "true");
    }
  }, [hasSessionCookie]);

  useEffect(() => {
    if (!hasSessionCookie && !hasAuthCookie()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const u = await fetchSession();
      if (cancelled) return;

      const sp = new URLSearchParams(window.location.search);
      const forcarLogin = sp.get("login") === "1";
      if (u && !forcarLogin) {
        setAguardandoRedirect(true);
        redirecionar(destinoPosAuth(u, sp.get("next")));
        return;
      }
      requestAnimationFrame(() => {
        document.querySelector("form[data-auth-form]")?.setAttribute("data-auth-ready", "true");
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasSessionCookie, redirecionar]);

  function setAuthMode(next: "login" | "register") {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (next === "register") {
      p.set("mode", "register");
    } else {
      p.delete("mode");
    }
    const qs = p.toString();
    router.replace(qs ? `/auth?${qs}` : "/auth");
  }

  function finishAuth(data: TokenResponse) {
    dispatchAuthSync();
    const next =
      nextParam ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null);
    if (
      isSafeInternalNext(next) &&
      data.usuario.tipo !== "organizador" &&
      (precisaOrganizador || nextRequerContaOrganizador(next))
    ) {
      void apiFetch("/api/auth/logout", { method: "POST" }).finally(() => {
        dispatchAuthSync();
        router.replace(authHrefPrecisaContaOrganizador(next));
      });
      return;
    }
    setAguardandoRedirect(true);
    redirecionar(destinoPosAuth(data.usuario, next));
  }

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      if (mode === "forgot") {
        const email = String(formData.get("email") ?? "");
        const r = await apiFetch<{ message: string }>("/api/auth/solicitar-recuperacao-senha", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setInfoMsg(r.message);
        return;
      }

      if (mode === "reset") {
        const novaSenha = String(formData.get("nova_senha") ?? "");
        if (novaSenha.length < 8) {
          setError("A nova senha deve ter pelo menos 8 caracteres.");
          return;
        }
        const r = await apiFetch<{ message: string }>("/api/auth/redefinir-senha", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: resetToken, nova_senha: novaSenha }),
        });
        setInfoMsg(r.message);
        router.replace("/auth");
        return;
      }

      const senha = String(formData.get("senha") ?? "");
      if (mode === "register" && senha.length < 8) {
        setError("A senha deve ter pelo menos 8 caracteres.");
        setLoading(false);
        return;
      }

      const payload =
        mode === "login"
          ? {
              email: String(formData.get("email") ?? ""),
              senha: String(formData.get("senha") ?? ""),
            }
          : {
              email: String(formData.get("email") ?? ""),
              nome: String(formData.get("nome") ?? ""),
              senha: String(formData.get("senha") ?? ""),
              tipo: String(formData.get("tipo") ?? "cliente"),
              aceita_comunicacao_email: aceitaComEmail,
              aceita_comunicacao_whatsapp: aceitaComWhatsapp,
              telefone: aceitaComWhatsapp
                ? onlyDigits(telefoneCadastro, 13) || null
                : null,
            };

      const data = await apiFetch<TokenResponse>(
        mode === "login" ? "/api/auth/login" : "/api/auth/registrar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      finishAuth(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro";
      const lower = message.toLowerCase();
      const isDev = process.env.NODE_ENV === "development";
      if (lower.includes("email ou senha incorretos")) {
        setError(
          isDev
            ? "Email ou senha incorretos. Se acabou de reiniciar o Docker ou limpar a base de dados, cadastre-se de novo."
            : "Email ou senha incorretos. Verifique os dados ou use «Esqueci minha senha».",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onSubmit(new FormData(e.currentTarget));
  }

  const formularioDesabilitado = loading || aguardandoRedirect;

  if (aguardandoRedirect) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12" aria-busy>
        <p className="text-center text-sm font-medium text-zinc-600">Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {sessaoExpirada ? (
        <div
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">Sua sessão expirou</p>
          <p className="mt-1">Faça login novamente para continuar de onde parou.</p>
        </div>
      ) : null}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          {mode === "login"
            ? "Acesse sua conta"
            : mode === "register"
              ? "Crie sua conta"
              : mode === "forgot"
                ? "Recuperar senha"
                : "Nova senha"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "login"
            ? "Bem-vindo de volta ao EventosBR."
            : mode === "register"
              ? "Junte-se à nossa plataforma."
              : mode === "forgot"
                ? "Enviaremos um link para redefinir sua senha."
                : "Escolha uma nova senha para sua conta."}
        </p>
        {fluxoOrganizador ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs leading-relaxed text-emerald-950">
            <strong className="font-semibold">Criar eventos</strong> é exclusivo para conta de{" "}
            <strong className="font-semibold">organizador</strong>. Entre com a sua ou cadastre-se
            escolhendo &quot;Organizador&quot; abaixo.
          </p>
        ) : null}
        {precisaOrganizador ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
            Esta conta é de <strong className="font-semibold">participante</strong>. Para publicar
            eventos, cadastre-se como organizador (outro e-mail) ou entre com uma conta de
            organizador. O destino continuará{" "}
            <span className="font-mono text-[11px]">{CRIAR_EVENTO_DESTINO}</span> após o cadastro
            correto.
          </p>
        ) : null}
      </div>

      <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <form data-auth-form method="post" action="#" onSubmit={handleFormSubmit} className="space-y-4">
          {infoMsg ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {infoMsg}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          ) : null}

          {mode === "reset" ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="nova_senha">
                Nova senha
                <span className="block font-normal text-zinc-500"> (mínimo 8 caracteres)</span>
              </label>
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                id="nova_senha"
                name="nova_senha"
                type="password"
                required
                minLength={8}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="email">
                  Email
                </label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  id="email"
                  name="email"
                  type="email"
                  required
                />
              </div>

              {mode === "register" ? (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-zinc-800" htmlFor="nome">
                      Nome
                    </label>
                    <input
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      id="nome"
                      name="nome"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-zinc-800" htmlFor="tipo">
                      Tipo
                    </label>
                    <select
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      id="tipo"
                      name="tipo"
                      defaultValue={defaultTipoRegistro}
                      key={defaultTipoRegistro}
                    >
                      <option value="cliente">Cliente</option>
                      <option value="organizador">Organizador</option>
                    </select>
                  </div>
                </>
              ) : null}

              {mode !== "forgot" ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-zinc-800" htmlFor="senha">
                      Senha
                      {mode === "register" ? (
                        <span className="block font-normal text-zinc-500"> (mínimo 8 caracteres)</span>
                      ) : null}
                    </label>
                    {mode === "login" ? (
                      <Link href="/auth?mode=forgot" className="text-xs font-medium text-emerald-800 hover:underline">
                        Esqueci minha senha
                      </Link>
                    ) : null}
                  </div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    id="senha"
                    name="senha"
                    type="password"
                    required
                    minLength={mode === "register" ? 8 : 1}
                  />
                </div>
              ) : null}
            </>
          )}

          {mode === "register" ? (
            <div className="space-y-3">
              <ComunicacaoMarketingOptIn
                email={aceitaComEmail}
                whatsapp={aceitaComWhatsapp}
                onEmailChange={setAceitaComEmail}
                onWhatsappChange={setAceitaComWhatsapp}
                telefoneInformado={!aceitaComWhatsapp || telefoneCadastro.replace(/\D/g, "").length >= 10}
                compact
              />
              {aceitaComWhatsapp ? (
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-zinc-700" htmlFor="tel_cadastro">
                    Telefone (WhatsApp)
                  </label>
                  <input
                    id="tel_cadastro"
                    inputMode="tel"
                    value={formatTelefoneBrMask(telefoneCadastro)}
                    onChange={(e) => setTelefoneCadastro(onlyDigits(e.target.value, 11))}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <button disabled={formularioDesabilitado} className="btn-success w-full" type="submit">
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Cadastrar"
                  : mode === "forgot"
                    ? "Enviar link"
                    : "Salvar nova senha"}
          </button>
        </form>

        {mode === "login" || mode === "register" ? (
          <div className="mt-6">
            <OAuthLoginButtons
              mode={mode === "register" ? "register" : "login"}
              tipoRegistro={defaultTipoRegistro}
              aceitaComEmail={aceitaComEmail}
              aceitaComWhatsapp={aceitaComWhatsapp}
              telefoneCadastro={telefoneCadastro}
              disabled={formularioDesabilitado}
              onSuccess={finishAuth}
              onError={setError}
            />
          </div>
        ) : null}

        <div className="mt-6 text-center text-sm text-zinc-600">
          {mode === "forgot" || mode === "reset" ? (
            <Link href="/auth" className="font-semibold text-zinc-900 hover:underline">
              Voltar ao login
            </Link>
          ) : (
            <>
              {mode === "login" ? "Não tem uma conta?" : "Já possui conta?"}{" "}
              <button
                type="button"
                className="font-semibold text-zinc-900 hover:underline"
                onClick={() => setAuthMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Cadastre-se" : "Faça login"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
