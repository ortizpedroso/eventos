import type { Metadata } from "next";

import { IngressosClient } from "@/app/conta/ingressos/ingressos-client";

export const metadata: Metadata = { title: "Ingressos" };

export default function OrganizadorIngressosPage() {
  return <IngressosClient />;
}
