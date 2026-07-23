import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ContaBanners } from "@/components/conta-banners";
import { OrganizadorPanelBootstrap } from "@/components/organizador-panel-bootstrap";

import { OrganizadorShell } from "./organizador-shell";

export const metadata: Metadata = {  title: "Painel do organizador | EventosBR",
  description: "Gerencie seus eventos, relatórios e finanças na EventosBR.",
};

export default function OrganizadorLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizadorShell>
      <OrganizadorPanelBootstrap />
      <ContaBanners />
      {children}
    </OrganizadorShell>
  );
}
