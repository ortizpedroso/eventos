import type { Metadata } from "next";

import { PerfilPublicoOrganizador } from "@/components/perfil-publico-organizador";

export const metadata: Metadata = {
  title: "Whitelabel",
  description: "Personalize a marca, o subdomínio e a página pública do seu perfil de organizador.",
};

export default function OrganizadorWhitelabelPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Whitelabel</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Personalize a marca, as cores, o subdomínio e a página pública que os compradores veem.
        </p>
      </div>
      <PerfilPublicoOrganizador />
    </div>
  );
}
