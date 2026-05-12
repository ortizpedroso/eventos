import { Suspense } from "react";

import { PagamentosClient } from "./pagamentos-client";

export default function MeusPagamentosPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-zinc-600">Carregando pagamentos…</div>
      }
    >
      <PagamentosClient />
    </Suspense>
  );
}
