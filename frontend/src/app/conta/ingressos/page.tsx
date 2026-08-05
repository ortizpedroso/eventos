import type { Metadata } from "next";

import { IngressosClient } from "./ingressos-client";

export const metadata: Metadata = { title: "Meus ingressos" };

export default function MeusIngressosPage() {
  return <IngressosClient />;
}
