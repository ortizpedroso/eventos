import type { ReactNode } from "react";

import { OrganizadorShell } from "@/app/organizador/organizador-shell";

/**
 * /eventos/[slug]/editar fica fora da árvore /organizador/*, então não herdava
 * o menu lateral (OrganizadorShell) automaticamente — corrigido aqui, sem mudar a URL.
 */
export default function EditarEventoLayout({ children }: { children: ReactNode }) {
  return <OrganizadorShell>{children}</OrganizadorShell>;
}
