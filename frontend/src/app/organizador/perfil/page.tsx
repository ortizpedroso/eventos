import type { Metadata } from "next";

import { PerfilClient } from "@/app/conta/perfil/perfil-client";

export const metadata: Metadata = {
  title: "Perfil | EventosBR",
  description: "Dados da sua conta de organizador na EventosBR.",
};

export default function OrganizadorPerfilPage() {
  return <PerfilClient />;
}
