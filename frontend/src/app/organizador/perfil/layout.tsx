import type { ReactNode } from "react";

import { PerfilTabs } from "@/components/perfil-tabs";

export default function OrganizadorPerfilLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col">
      <PerfilTabs base="/organizador/perfil" />
      {children}
    </div>
  );
}
