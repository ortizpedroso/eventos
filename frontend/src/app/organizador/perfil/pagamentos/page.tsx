import { Suspense } from "react";

import { PagamentosClient } from "@/app/conta/pagamentos/pagamentos-client";

export default function OrganizadorPagamentosPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-600">Carregando pagamentos…</div>}>
      <PagamentosClient />
    </Suspense>
  );
}
