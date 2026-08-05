import type { Metadata } from "next";

import { PagamentosClient } from "@/app/conta/pagamentos/pagamentos-client";

export const metadata: Metadata = { title: "Pagamentos" };

type Props = {
  searchParams: Promise<{ ok?: string; ingresso?: string }>;
};

export default async function OrganizadorPagamentosPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <PagamentosClient
      okParam={sp.ok ?? null}
      ingressoParam={sp.ingresso ?? null}
    />
  );
}
