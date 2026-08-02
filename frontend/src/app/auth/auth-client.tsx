"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ComunicacaoMarketingOptIn } from "@/components/comunicacao-marketing-opt-in";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import {
  limparOrganizadorCadastroPendente,
  lerOrganizadorCadastroPendente,
  OrganizadorCadastroPendente,
  salvarOrganizadorCadastroPendente,
} from "@/components/organizador-cadastro-pendente";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { LoginTotpChallenge, TokenResponse, Usuario } from "@/lib/types";
import { apiFetch, fetchSession, peekSessionCache } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
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
  resetToken?: string;
  modeParam?: string;
  fluxoOrganizador?: boolean;
  precisaOrganizador?: boolean;
  sessaoExpirada?: boolean;
  tipoParam?: string;
  nextParam?: string;
};

function isLoginTotpChallenge(
  data: TokenResponse | LoginTotpChallenge,
): data is LoginTotpChallenge {
  return (data as LoginTotpChallenge).requires_2fa === true;
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export default function AuthClient({
  resetToken,
  modeParam,
  fluxoOrganizador = false,
  precisaOrganizador = false,
  sessaoExpirada = false,
  tipoParam,
  nextParam,
}: AuthClientProps) {
  const router = useRouter();
  const mode =
    resetToken
      ? "reset"
      : modeParam === "forgot"
        ? "forgot"
        : modeParam === "register"
          ? "register"
          : "login";

  const defaultTipoRegistro = useMemo(() => {
    if (tipoParam === "organizador") return "organizador";
    if (fluxoOrganizador || precisaOrganizador) return "organizador";
    return "cliente";
  }, [tipoParam, fluxoOrganizador, precisaOrganizador]);

  const cachedSession = peekSessionCache();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [aguardandoRedirect, setAguardandoRedirect] = useState(
    () => cachedSession != null,
  );
  const [sessaoVerificada, setSessaoVerificada] = useState(() => cachedSession === null);
  const [aceitaComEmail, setAceitaComEmail] = useState(false);
  const [aceitaComWhatsapp, setAceitaComWhatsapp] = useState(false);
  const [telefoneCadastro, setTelefoneCadastro] = useState("");
  const [senhaDigitada, setSenhaDigitada] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [login2fa, setLogin2fa] = useState<{ loginToken: string } | null>(null);
  const [codigo2fa, setCodigo2fa] = useState("");
  const [lembrarDispositivo, setLembrarDispositivo] = useState(true);
  const [cadastroOrganizadorPendente, setCadastroOrganizadorPendente] = useState<{
    email: string;
    message: string;
  } | null>(null);
  const [reenviandoConfirmacao, setReenviandoConfirmacao] = useState(false);

  const redirecionar = useCallback(
    (destino: string) => {
      router.replace(destino);
      window.setTimeout(() => {
        if (window.location.pathname.startsWith("/auth")) {
          window.location.assign(destino);
        }
      }, 150);
    },
    [router],
  );

  useEffect(() => {
    if (sessaoVerificada && !aguardandoRedirect) {
      requestAnimationFrame(() => {
        document.querySelector("form[data-auth-form]")?.setAttribute("data-auth-ready", "true");
      });
    }
  }, [sessaoVerificada, aguardandoRedirect]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("confirmar") !== "1") return;
    const stored = lerOrganizadorCadastroPendente();
    if (stored) setCadastroOrganizadorPendente(stored);
  }, []);

  useEffect(() => {
    const cached = peekSessionCache();
    if (cached === null) {
      setSessaoVerificada(true);
      setAguardandoRedirect(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const u = cached ?? (await fetchSession());
      if (cancelled) return;
      const sp = new URLSearchParams(window.location.search);
      const forcarLogin = sp.get("login") === "1";
      if (u && !forcarLogin) {
        setAguardandoRedirect(true);
        redirecionar(destinoPosAuth(u, sp.get("next") || nextParam || null));
        return;
      }
      setSessaoVerificada(true);
      setAguardandoRedirect(false);
    })();
    return () => {
      cancelled = true;
    };
    // Verificação de sessão só na montagem — evita loop com deps instáveis (router/searchParams).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!data.access_token || !data.usuario) {
      setError("Resposta de autenticação incompleta.");
      return;
    }
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
        await apiFetch<{ message: string }>("/api/auth/solicitar-recuperacao-senha", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, turnstile_token: turnstileToken }),
        });
        setInfoMsg(
          "Pronto. Se este e-mail estiver cadastrado (incluindo compra rápida sem senha), " +
            "enviamos um link para criar ou redefinir a senha. Confira a caixa de entrada e o spam — " +
            "o link vale por 1 hora.",
        );
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
              turnstile_token: turnstileToken,
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
              turnstile_token: turnstileToken,
            };

      const data = await apiFetch<TokenResponse | LoginTotpChallenge>(
        mode === "login" ? "/api/auth/login" : "/api/auth/registrar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (isLoginTotpChallenge(data)) {
        setLogin2fa({ loginToken: data.login_token });
        return;
      }

      if (mode === "register" && data.pending_email_verification) {
        const pendente = {
          email: data.email || String(formData.get("email") ?? ""),
          message:
            data.message ||
            "Enviamos um e-mail de confirmação. Abra o link (válido por 24 horas) para ativar sua conta.",
        };
        salvarOrganizadorCadastroPendente(pendente);
        setCadastroOrganizadorPendente(pendente);
        const sp = new URLSearchParams(window.location.search);
        sp.delete("mode");
        sp.set("confirmar", "1");
        const qs = sp.toString();
        router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
        return;
      }

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

  async function onSubmit2fa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!login2fa) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TokenResponse>("/api/auth/2fa/verificar-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login_token: login2fa.loginToken,
          codigo: codigo2fa.trim(),
          lembrar_dispositivo: lembrarDispositivo,
        }),
      });
      finishAuth(data);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function reenviarConfirmacaoCadastro() {
    if (!cadastroOrganizadorPendente) return;
    setReenviandoConfirmacao(true);
    setError(null);
    try {
      const r = await apiFetch<{ message: string; dev_link?: string }>(
        "/api/auth/reenviar-verificacao-cadastro",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: cadastroOrganizadorPendente.email,
            turnstile_token: turnstileToken,
          }),
        },
      );
      setInfoMsg(r.dev_link ? `${r.message} Link dev: ${r.dev_link}` : r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível reenviar.");
    } finally {
      setReenviandoConfirmacao(false);
    }
  }

  const turnstileObrigatorio =
    Boolean(TURNSTILE_SITE_KEY) && mode !== "reset" && !cadastroOrganizadorPendente;
  const formularioDesabilitado =
    loading || aguardandoRedirect || (turnstileObrigatorio && !turnstileToken);

  function irParaLoginAposCadastro() {
    limparOrganizadorCadastroPendente();
    setCadastroOrganizadorPendente(null);
    setInfoMsg(null);
    setError(null);
    setTurnstileToken(null);
    setAuthMode("login");
  }

  if (!sessaoVerificada) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col" aria-busy aria-label="Verificando sessão">
        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 animate-pulse">
          <div className="mb-6 h-8 w-3/4 rounded bg-zinc-200" />
          <div className="h-10 w-full rounded bg-zinc-200" />
          <div className="mt-4 h-10 w-full rounded bg-zinc-200" />
          <div className="mt-4 h-10 w-full rounded bg-zinc-200" />
          </div>
        </div>
      </div>
    );
  }

  if (cadastroOrganizadorPendente) {
    return (
      <OrganizadorCadastroPendente
        data={cadastroOrganizadorPendente}
        infoMsg={infoMsg}
        error={error}
        reenviando={reenviandoConfirmacao}
        reenviarDesabilitado={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
        onReenviar={() => void reenviarConfirmacaoCadastro()}
        onIrLogin={irParaLoginAposCadastro}
        onToken={setTurnstileToken}
      />
    );
  }

  if (login2fa) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Verificação em duas etapas</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Digite o código do seu app autenticador (ou um código de recuperação).
          </p>
        </div>
        <form onSubmit={onSubmit2fa} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          ) : null}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="codigo2fa">
              Código de 6 dígitos ou de recuperação
            </label>
            <input
              id="codigo2fa"
              name="codigo2fa"
              autoComplete="one-time-code"
              inputMode="text"
              autoFocus
              required
              value={codigo2fa}
              onChange={(e) => setCodigo2fa(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="000000"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={lembrarDispositivo}
              onChange={(e) => setLembrarDispositivo(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
            />
            Lembrar deste dispositivo por 30 dias (não pede o código de novo aqui)
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Verificando…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLogin2fa(null);
              setCodigo2fa("");
              setError(null);
            }}
            className="w-full text-center text-xs font-medium text-zinc-500 hover:underline"
          >
            Voltar ao login
          </button>
        </form>
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
                ? "Criar senha ou recuperar acesso"
                : "Nova senha"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "login"
            ? "Bem-vindo de volta ao EventosBR."
            : mode === "register"
              ? "Junte-se à nossa plataforma."
              : mode === "forgot"
                ? "Use o mesmo e-mail da compra. Funciona para quem comprou sem senha (compra rápida) e para quem esqueceu a senha."
                : "Escolha uma senha para acessar sua conta e ver seus ingressos."}
        </p>
        {mode === "forgot" ? (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs leading-relaxed text-sky-950">
            <strong className="font-semibold">Compra rápida?</strong> Sua conta existe, mas ainda
            não tem senha. Informe o e-mail usado na compra, abra o link que enviamos e defina uma
            senha para ver seus ingressos.
          </p>
        ) : null}
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

      <div
        className={`relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 ${
          aguardandoRedirect ? "pointer-events-none opacity-60" : ""
        }`}
        aria-busy={aguardandoRedirect || undefined}
      >
        {aguardandoRedirect ? (
          <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-zinc-600">
            Redirecionando…
          </p>
        ) : null}
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
                autoComplete="new-password"
                required
                minLength={8}
                onChange={(e) => setSenhaDigitada(e.target.value)}
              />
              <PasswordStrengthMeter senha={senhaDigitada} />
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
                  autoComplete="email"
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
                      autoComplete="name"
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
                      <Link href="/auth?mode=forgot" className="text-xs font-medium text-emerald-700 hover:underline">
                        Esqueci minha senha / primeiro acesso
                      </Link>
                    ) : null}
                  </div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    id="senha"
                    name="senha"
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    onChange={mode === "register" ? (e) => setSenhaDigitada(e.target.value) : undefined}
                  />
                  {mode === "register" ? <PasswordStrengthMeter senha={senhaDigitada} /> : null}
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
                    autoComplete="tel-national"
                    value={formatTelefoneBrMask(telefoneCadastro)}
                    onChange={(e) => setTelefoneCadastro(onlyDigits(e.target.value, 11))}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {mode !== "reset" ? (
            <TurnstileWidget onToken={setTurnstileToken} />
          ) : null}

          <button disabled={formularioDesabilitado} className="btn-success w-full" type="submit">
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Cadastrar"
                  : mode === "forgot"
                    ? "Enviar link de acesso"
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
