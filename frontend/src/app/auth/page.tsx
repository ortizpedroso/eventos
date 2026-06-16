import AuthClient from "./auth-client";

function q(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <AuthClient
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
