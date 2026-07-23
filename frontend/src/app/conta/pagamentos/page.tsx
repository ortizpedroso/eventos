import { PagamentosClient } from "./pagamentos-client";

type Props = {
  searchParams: Promise<{ ok?: string; ingresso?: string }>;
};

export default async function MeusPagamentosPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <PagamentosClient
      okParam={sp.ok ?? null}
      ingressoParam={sp.ingresso ?? null}
    />
  );
}
