import AuthClient from "./auth-client";
import {
  enrichAuthSearchParams,
  readAuthSearchParams,
  resolveAuthMode,
} from "@/lib/auth-search-params-core";
import { nextRequerContaOrganizador, normalizeAuthNext } from "@/lib/criar-evento-routes";

export const dynamic = "force-dynamic";

function q(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

/** searchParams no servidor — título/mode corretos no 1º paint; AuthClient sincroniza no cliente. */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const forcarLogin = q(sp, "login") === "1";
  const nextParam = normalizeAuthNext(q(sp, "next"));
  const destinoOrganizador = Boolean(nextParam && nextRequerContaOrganizador(nextParam));

  const authParams = enrichAuthSearchParams(
    readAuthSearchParams(
      new URLSearchParams(
        [
          q(sp, "reset") ? ["reset", q(sp, "reset")!] : null,
          q(sp, "mode") ? ["mode", q(sp, "mode")!] : null,
          q(sp, "fluxo") === "organizador" ? ["fluxo", "organizador"] : null,
          q(sp, "precisa") === "organizador" ? ["precisa", "organizador"] : null,
          q(sp, "expirado") === "1" ? ["expirado", "1"] : null,
          q(sp, "tipo") ? ["tipo", q(sp, "tipo")!] : null,
          nextParam ? ["next", nextParam] : null,
          forcarLogin ? ["login", "1"] : null,
        ]
          .filter(Boolean)
          .map((e) => e as [string, string]) as [string, string][],
      ).toString(),
    ),
    forcarLogin,
  );
  if (destinoOrganizador && !forcarLogin) {
    authParams.fluxoOrganizador = true;
    authParams.modeParam = authParams.modeParam ?? "register";
  }
  const mode = resolveAuthMode(authParams, forcarLogin);

  return (
    <>
      <AuthClient
        mode={mode}
        forcarLogin={forcarLogin}
        resetToken={q(sp, "reset")}
        modeParam={authParams.modeParam}
        fluxoOrganizador={authParams.fluxoOrganizador}
        precisaOrganizador={authParams.precisaOrganizador}
        sessaoExpirada={q(sp, "expirado") === "1"}
        tipoParam={q(sp, "tipo")}
        nextParam={nextParam}
      />
    </>
  );
}
