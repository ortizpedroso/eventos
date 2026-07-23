import { Suspense } from "react";

import { VerificarEmailClient } from "./verificar-email-client";

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerificarEmailClient />
    </Suspense>
  );
}
