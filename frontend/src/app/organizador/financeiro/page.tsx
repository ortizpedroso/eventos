import { Suspense } from "react";

import { OrganizadorFinanceiroClient } from "./organizador-financeiro-client";

export default function OrganizadorFinanceiroPage() {
  return (
    <Suspense fallback={null}>
      <OrganizadorFinanceiroClient />
    </Suspense>
  );
}
