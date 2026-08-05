import type { Metadata } from "next";

import { PerfilClient } from "@/app/conta/perfil/perfil-client";

export const metadata: Metadata = { title: "Perfil" };

export default function OrganizadorPerfilPage() {
  return <PerfilClient />;
}
