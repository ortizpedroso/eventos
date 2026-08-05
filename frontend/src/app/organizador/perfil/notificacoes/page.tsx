import type { Metadata } from "next";

import { NotificacoesClient } from "@/app/conta/notificacoes/notificacoes-client";

export const metadata: Metadata = { title: "Notificações" };

export default function OrganizadorNotificacoesPage() {
  return <NotificacoesClient />;
}
