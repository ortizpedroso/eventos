"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { TokenResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { dispatchAuthSync } from "@/lib/auth-sync";
import {
  authHrefPrecisaContaOrganizador,
  CRIAR_EVENTO_DESTINO,
  isSafeInternalNext,
} from "@/lib/criar-evento-routes";

function setToken(token: string) {
  window.localStorage.setItem("eventosbr_token", token);
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

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
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
            };

      const data = await apiFetch<TokenResponse>(
        mode === "login" ? "/api/auth/login" : "/api/auth/registrar",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      setToken(data.access_token);
      router.refresh();

      const next = searchParams.get("next");
      if (isSafeInternalNext(next) && data.usuario.tipo === "organizador") {
        router.push(next);
        return;
      }
      if (isSafeInternalNext(next) && data.usuario.tipo !== "organizador") {
        window.localStorage.removeItem("eventosbr_token");
        dispatchAuthSync();
        router.replace(authHrefPrecisaContaOrganizador(next));
        return;
      }

      const destino = data.usuario.tipo === "organizador" ? "/organizador/eventos" : "/";
      router.push(destino);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro";
      const lower = message.toLowerCase();
      if (
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
        <form action={onSubmit} className="space-y-4">
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
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              id="senha"
              name="senha"
              type="password"
              required
            />
          </div>

          <button disabled={loading} className="btn-success w-full" type="submit">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>

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
