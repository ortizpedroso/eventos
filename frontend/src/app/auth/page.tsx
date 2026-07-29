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
  const sessaoExpirada = q(sp, "expirado") === "1";
  // Sessão expirada = a pessoa JÁ tinha conta e só precisa logar de novo — nunca
  // forçar modo cadastro nesse caso, mesmo que o "next" aponte pra /organizador/*
  // (senão um organizador cuja sessão expirou via alguma página /organizador/...
  // cai na tela de CRIAR CONTA em vez de LOGIN, bug reportado pelo usuário).
  const forcarLogin = q(sp, "login") === "1" || sessaoExpirada;
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
      sessaoExpirada={sessaoExpirada}
      tipoParam={q(sp, "tipo")}
      nextParam={nextParam}
    />
  );
}
