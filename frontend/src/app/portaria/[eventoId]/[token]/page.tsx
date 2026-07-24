import type { Metadata } from "next";
import { Suspense } from "react";

import { PortariaClient } from "./portaria-client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ eventoId: string; token: string }>;
};

export default async function PortariaPage({ params }: Props) {
  const { eventoId, token } = await params;
  return (
    <Suspense fallback={null}>
      <PortariaClient eventoId={eventoId} token={token} />
    </Suspense>
  );
}
