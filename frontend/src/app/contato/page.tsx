import type { Metadata } from "next";

import { ContatoWhatsappCta } from "@/components/contato-whatsapp-cta";
import { fetchPlatformSettings } from "@/lib/platform-settings";
import { resolveWhatsappHref } from "@/lib/whatsapp-contato";

import { ContatoFormClient } from "./contato-form-client";

export const metadata: Metadata = {
  title: "Fale conosco | EventosBR",
  description: "Tem dúvidas sobre um evento, ingresso ou a plataforma? Fale com a nossa equipe.",
};

const SLUG_EVENTO = /^[a-z0-9-]{1,120}$/;

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ denuncia?: string | string[] }>;
}) {
  const { denuncia } = await searchParams;
  const slugDenunciado = typeof denuncia === "string" && SLUG_EVENTO.test(denuncia) ? denuncia : null;
  const platform = await fetchPlatformSettings();
  const whatsappHref = resolveWhatsappHref(platform);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Contato
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-600 text-justify">
        Dúvidas sobre um evento, um ingresso, reembolso ou sobre a plataforma? Preencha o
        formulário abaixo — respondemos por e-mail.
      </p>
      <ContatoWhatsappCta initialHref={whatsappHref} />
      {slugDenunciado ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-contato-denuncia>
          Você está denunciando o evento <strong>/eventos/{slugDenunciado}</strong>. Conte o que há de errado:
          conteúdo ofensivo, golpe, informação falsa ou outro problema. A equipe da EventosBR analisa e pode
          tirar o evento do ar.
        </p>
      ) : null}
      <ContatoFormClient
        assuntoInicial={slugDenunciado ? `Denúncia: evento ${slugDenunciado}` : undefined}
        mensagemDica={slugDenunciado ? "Descreva o problema que você encontrou neste evento." : undefined}
      />
    </div>
  );
}
