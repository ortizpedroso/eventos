import { Suspense } from "react";

import { IngressoQrClient } from "./ingresso-qr-client";

export default function IngressoQrPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-16 text-center text-sm text-zinc-500">A carregar ingresso…</div>
      }
    >
      <IngressoQrClient />
    </Suspense>
  );
}
