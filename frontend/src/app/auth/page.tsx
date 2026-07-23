import AuthClient from "./auth-client";

function q(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

/** Sem cookies() — prefetch mais rápido; sessão checada só no cliente após mount. */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <AuthClient
      forcarLogin={q(sp, "login") === "1"}
      resetToken={q(sp, "reset")}
      modeParam={q(sp, "mode")}
      fluxoOrganizador={q(sp, "fluxo") === "organizador"}
      precisaOrganizador={q(sp, "precisa") === "organizador"}
      sessaoExpirada={q(sp, "expirado") === "1"}
      tipoParam={q(sp, "tipo")}
      nextParam={q(sp, "next")}
    />
  );
}
