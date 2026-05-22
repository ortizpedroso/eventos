"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ComunicacaoMarketingOptIn } from "@/components/comunicacao-marketing-opt-in";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import type { TokenResponse, Usuario } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
import { onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";
import {
  authHrefPrecisaContaOrganizador,
  CRIAR_EVENTO_DESTINO,
  isSafeInternalNext,
} from "@/lib/criar-evento-routes";

const TOKEN_KEY = "eventosbr_token";

function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

function destinoPosAuth(usuario: Usuario, next: string | null): string {
  if (isSafeInternalNext(next) && usuario.tipo === "organizador") {
    return next;
  }
  return usuario.tipo === "organizador" ? "/organizador/eventos" : "/";
}

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";
  const fluxoOrganizador = searchParams.get("fluxo") === "organizador";
  const precisaOrganizador = searchParams.get("precisa") === "organizador";

  const defaultTipoRegistro = useMemo(() => {
    if (searchParams.get("tipo") === "organizador") return "organizador";
    if (fluxoOrganizador || precisaOrganizador) return "organizador";
    return "cliente";
  }, [searchParams, fluxoOrganizador, precisaOrganizador]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checandoSessao, setChecandoSessao] = useState(true);
  const [aceitaComEmail, setAceitaComEmail] = useState(false);
  const [aceitaComWhatsapp, setAceitaComWhatsapp] = useState(false);
  const [telefoneCadastro, setTelefoneCadastro] = useState("");

  const redirecionar = useCallback(
    (destino: string) => {
      router.replace(destino);
      /* Fallback: em alguns builds o App Router não troca a rota após login na mesma página. */
      window.setTimeout(() => {
        if (window.location.pathname.startsWith("/auth")) {
          window.location.assign(destino);
        }
      }, 150);
    },
    [router],
  );

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setChecandoSessao(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const u = await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        const next = searchParams.get("next");
        redirecionar(destinoPosAuth(u, next));
      } catch {
        if (!cancelled) setChecandoSessao(false);
      }
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
    setToken(data.access_token);
    dispatchAuthSync();
    const next = searchParams.get("next");
    if (isSafeInternalNext(next) && data.usuario.tipo !== "organizador") {
      window.localStorage.removeItem(TOKEN_KEY);
      dispatchAuthSync();
      router.replace(authHrefPrecisaContaOrganizador(next));
      return;
    }
    setChecandoSessao(true);
    redirecionar(destinoPosAuth(data.usuario, next));
  }

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
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
      if (lower.includes("email ou senha incorretos")) {
        setError(
          "Email ou senha incorretos. Se acabou de reiniciar o Docker ou limpar a base de dados, cadastre-se de novo.",
        );
      } else if (
        lower.includes("responsibilities of managing losses") ||
        lower.includes("managing losses") ||
        (lower.includes("responsabilidade") && lower.includes("perda")) ||
        lower.includes("loss liability") ||
        lower.includes("connected account agreement")
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
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "login"
            ? "Bem-vindo de volta ao EventosBR."
            : "Junte-se à nossa plataforma."}
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
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          ) : null}

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

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800" htmlFor="senha">
              Senha
              {mode === "register" ? (
                <span className="block font-normal text-zinc-500"> (mínimo 8 caracteres)</span>
              ) : null}
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="senha"
              name="senha"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </div>

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
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <div className="mt-6">
          <OAuthLoginButtons
            mode={mode}
            tipoRegistro={defaultTipoRegistro}
            aceitaComEmail={aceitaComEmail}
            aceitaComWhatsapp={aceitaComWhatsapp}
            telefoneCadastro={telefoneCadastro}
            disabled={loading}
            onSuccess={finishAuth}
            onError={setError}
          />
        </div>

        <div className="mt-6 text-center text-sm text-zinc-600">
          {mode === "login" ? "Não tem uma conta?" : "Já possui conta?"}{" "}
          <button
            type="button"
            className="font-semibold text-zinc-900 hover:underline"
            onClick={() => setAuthMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Cadastre-se" : "Faça login"}
          </button>
        </div>
      </div>
    </div>
  );
}
