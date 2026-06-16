import { Suspense } from "react";

import { VerificarEmailClient } from "./verificar-email-client";

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Carregando…</p>}>
      <VerificarEmailClient />
    </Suspense>
  );
}
