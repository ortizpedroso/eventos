import type { Metadata } from "next";

import { PerfilClient } from "./perfil-client";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return <PerfilClient />;
}