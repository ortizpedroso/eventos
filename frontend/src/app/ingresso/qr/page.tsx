import { Suspense } from "react";

import { IngressoQrClient } from "./ingresso-qr-client";

export default function IngressoQrPage() {
  return (
    <Suspense fallback={null}>
      <IngressoQrClient />
    </Suspense>
  );
}
