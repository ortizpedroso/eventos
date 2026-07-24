import type { Metadata } from "next";

import AuthClient from "@/app/auth/auth-client";
import { CRIAR_EVENTO_DESTINO } from "@/lib/criar-evento-routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastro de organizador | EventosBR",
  description: "Crie sua conta de organizador e publique seu primeiro evento no EventosBR.",
};

/** URL amigável para cadastro de organizador (destino após sucesso: criar evento). */
export default function CadastroOrganizadorPage() {
  return (
    <AuthClient
      modeParam="register"
      fluxoOrganizador
      nextParam={CRIAR_EVENTO_DESTINO}
    />
  );
}
