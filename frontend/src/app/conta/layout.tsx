import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ContaBanners } from "@/components/conta-banners";
import { ContaShell } from "@/components/conta-shell";

export const metadata: Metadata = {
  title: "Minha conta | EventosBR",
  description: "Ingressos, perfil e notificações na EventosBR.",
  robots: { index: false, follow: false },
};

export default function ContaLayout({ children }: { children: ReactNode }) {
  return (
    <ContaShell>
      <ContaBanners />
      {children}
    </ContaShell>
  );
}
