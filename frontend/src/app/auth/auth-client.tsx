"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ComunicacaoMarketingOptIn } from "@/components/comunicacao-marketing-opt-in";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import type { TokenResponse, Usuario } from "@/lib/types";
import { apiFetch, fetchSession } from "@/lib/api";
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

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const mode =
    resetToken
      ? "reset"
      : searchParams.get("mode") === "forgot"
        ? "forgot"
        : searchParams.get("mode") === "register"
          ? "register"
          : "login";
  const fluxoOrganizador = searchParams.get("fluxo") === "organizador";
  const precisaOrganizador = searchParams.get("precisa") === "organizador";
  const sessaoExpirada = searchParams.get("expirado") === "1";

  const defaultTipoRegistro = useMemo(() => {
    if (searchParams.get("tipo") === "organizador") return "organizador";
    if (fluxoOrganizador || precisaOrganizador) return "organizador";
    return "cliente";
  }, [searchParams, fluxoOrganizador, precisaOrganizador]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [checandoSessao, setChecandoSessao] = useState(true);
  const [aceitaComEmail, setAceitaComEmail] = useState(false);
  const [aceitaComWhatsapp, setAceitaComWhatsapp] = useState(false);
  const [telefoneCadastro, setTelefoneCadastro] = useState("");

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
    let cancelled = false;
    void (async () => {
      const u = await fetchSession();
      if (cancelled) return;
      const forcarLogin = searchParams.get("login") === "1";
      if (u && !forcarLogin) {
        const next = searchParams.get("next");
        redirecionar(destinoPosAuth(u, next));
        return;
      }
      setChecandoSessao(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, redirecionar]);

  function setAuthMode(next: "login" | "register") {
    const p = new URLSearchParams(searchParams.toString());
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
    const next = searchParams.get("next");
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
    setChecandoSessao(true);
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
      } else if (
        isDev &&
        (lower.includes("responsibilities of managing losses") ||
          lower.includes("managing losses") ||
          (lower.includes("responsabilidade") && lower.includes("perda")) ||
          lower.includes("loss liability") ||
          lower.includes("connected account agreement"))
      ) {
        setError(
          [
            "Stripe Connect: no Dashboard (dashboard.stripe.com) abra Settings → Connect e conclua/aceite os termos da plataforma, incluindo responsabilidade por perdas.",
            "Enquanto isso, no arquivo .env da API: STRIPE_SKIP_CONNECT_ON_REGISTER=true permite cadastrar organizador sem criar conta Connect; STRIPE_DISABLED=true desliga Stripe por completo (apenas testes). Reinicie a API após alterar o .env.",
          ].join("\n\n"),
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

  if (checandoSessao) {
    return (
      <div
        className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-zinc-50 p-8 animate-pulse"
        aria-busy
        aria-label="Verificando sessão"
      >
        <div className="mb-6 h-8 w-3/4 rounded bg-zinc-200" />
        <div className="h-10 w-full rounded bg-zinc-200" />
        <div className="mt-4 h-10 w-full rounded bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md">
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleFormSubmit} className="space-y-4">
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

          <button disabled={loading} className="btn-success w-full" type="submit">
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
              disabled={loading}
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
