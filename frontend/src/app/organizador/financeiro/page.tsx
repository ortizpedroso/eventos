import { Suspense } from "react";

import { OrganizadorFinanceiroClient } from "./organizador-financeiro-client";

export default function OrganizadorFinanceiroPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-600">Carregando financeiro…</div>}>
      <OrganizadorFinanceiroClient />
    </Suspense>
  );
}
