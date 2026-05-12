import type { Metadata } from "next";

import { NovoEventoForm } from "@/app/eventos/novo/novo-evento-client";

export const metadata: Metadata = {
  title: "Novo evento | EventosBR",
  description: "Crie um novo evento na EventosBR.",
};

export default function OrganizadorNovoEventoPage() {
  return <NovoEventoForm variant="painel" />;
}
