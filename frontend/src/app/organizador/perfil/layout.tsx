import type { ReactNode } from "react";

import { PerfilTabs } from "@/components/perfil-tabs";

export default function OrganizadorPerfilLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4" data-mobile-justify>
      <PerfilTabs base="/organizador/perfil" />
      <div className="min-h-[50vh]">{children}</div>
    </div>
  );
}
