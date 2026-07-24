import AuthClient from "./auth-client";
import { redirect } from "next/navigation";
import {
  CRIAR_EVENTO_DESTINO,
  normalizeAuthNext,
  nextRequerContaOrganizador,
} from "@/lib/criar-evento-routes";

export const dynamic = "force-dynamic";

function q(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

/** SSR: deriva mode=register quando next=/organizador/* (sem depender de JS no cliente). */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const forcarLogin = q(sp, "login") === "1";
  const nextParam = normalizeAuthNext(q(sp, "next"));
  const destinoOrganizador = Boolean(nextParam && nextRequerContaOrganizador(nextParam));

  let modeParam = q(sp, "mode");
  const fluxoOrganizador = q(sp, "fluxo") === "organizador" || destinoOrganizador;
  if (destinoOrganizador && !forcarLogin && !modeParam) {
    modeParam = "register";
  }

  if (
    !forcarLogin &&
    !q(sp, "reset") &&
    modeParam === "register" &&
    fluxoOrganizador &&
    nextParam === CRIAR_EVENTO_DESTINO &&
    q(sp, "precisa") !== "organizador"
  ) {
    redirect("/cadastro");
  }

  return (
    <AuthClient
      resetToken={q(sp, "reset")}
      modeParam={modeParam}
      fluxoOrganizador={fluxoOrganizador}
      precisaOrganizador={q(sp, "precisa") === "organizador"}
      sessaoExpirada={q(sp, "expirado") === "1"}
      tipoParam={q(sp, "tipo")}
      nextParam={nextParam}
    />
  );
}
