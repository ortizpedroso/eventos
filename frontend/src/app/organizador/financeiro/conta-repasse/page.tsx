import type { Metadata } from "next";

import { OrganizadorRepasseAcompanhamento } from "@/components/organizador-repasse-acompanhamento";

export const metadata: Metadata = { title: "Conta de repasse" };

export default function ContaRepassePage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <OrganizadorRepasseAcompanhamento />
    </div>
  );
}
