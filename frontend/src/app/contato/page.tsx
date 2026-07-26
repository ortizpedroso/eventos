import type { Metadata } from "next";

import { ContatoFormClient } from "./contato-form-client";

export const metadata: Metadata = {
  title: "Fale conosco | EventosBR",
  description: "Tem dúvidas sobre um evento, ingresso ou a plataforma? Fale com a nossa equipe.",
};

export default function ContatoPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Fale conosco</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Dúvidas sobre um evento, um ingresso, reembolso ou sobre a plataforma? Preencha o
        formulário abaixo — respondemos por e-mail.
      </p>
      <ContatoFormClient />
    </div>
  );
}
