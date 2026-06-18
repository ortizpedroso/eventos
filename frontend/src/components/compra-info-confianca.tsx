import Link from "next/link";

import { nomeProcessadorPagamento } from "@/lib/payment-provider";

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  );
}

function IconFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 6h11l-2 3 2 3H3" />
    </svg>
  );
}

/** Bloco de credibilidade na página pública do evento (largura total, abaixo dos cards Sobre / Comprar). */
export function CompraInfoConfianca() {
  const processador = nomeProcessadorPagamento();
  const emailDenuncia = process.env.NEXT_PUBLIC_EMAIL_DENUNCIAS?.trim();
  const emailContato = process.env.NEXT_PUBLIC_EMAIL_CONTATO?.trim();
  const denunciaMailto = emailDenuncia
    ? `mailto:${emailDenuncia}?subject=${encodeURIComponent("Denúncia — EventosBR")}`
    : null;
  const contatoMailto = emailContato
    ? `mailto:${emailContato}?subject=${encodeURIComponent("Dúvida — EventosBR")}`
    : null;

  return (
    <section
      className="w-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm [&_p]:text-justify"
      aria-labelledby="compra-confianca-heading"
    >
      <h3 id="compra-confianca-heading" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Segurança e transparência
      </h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 text-xs leading-relaxed text-emerald-950 sm:col-span-2">
          <p className="font-semibold text-emerald-900">Reembolso em até 10 dias</p>
          <p className="mt-1">
            Após a compra, cancele e peça reembolso em Minha conta → Pagamentos, dentro do prazo legal,
            sem precisar falar com o organizador (se o ingresso não tiver sido usado na entrada).
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs leading-relaxed text-zinc-600">
          <p className="flex items-start gap-2 font-medium text-zinc-800">
            <IconFlag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            Algo suspeito nesta página ou no evento?
          </p>
          <p className="mt-2">
            {denunciaMailto ? (
              <a
                href={denunciaMailto}
                className="font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                Denunciar
              </a>
            ) : (
              <Link href="/privacidade#denunciar" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                Denunciar
              </Link>
            )}
            {emailDenuncia ? (
              <span className="text-zinc-500"> — envie e-mail com o máximo de detalhe possível.</span>
            ) : (
              <span className="text-zinc-500">
                {" "}
                — veja como comunicar na{" "}
                <Link href="/privacidade#denunciar" className="text-emerald-800 underline-offset-2 hover:underline">
                  política de privacidade
                </Link>
                .
              </span>
            )}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs leading-relaxed text-zinc-600">
          <p className="flex items-start gap-2 font-medium text-zinc-800">
            <IconCard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            Pagamento
          </p>
          <p className="mt-2">
            PIX e cartão são processados pelo{" "}
            <strong className="font-medium text-zinc-700">Asaas</strong>, instituição de pagamento regulada. A
            EventosBR <strong className="font-medium text-zinc-700">não armazena</strong> o número completo do cartão.
          </p>
          <p className="mt-2 text-zinc-500">
            Pagamento seguro via {processador}. Parcelamento, quando disponível, segue as opções do checkout.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs leading-relaxed text-zinc-600 sm:col-span-2">
          <p className="flex items-start gap-2 font-medium text-zinc-800">
            <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            Ligação encriptada
          </p>
          <p className="mt-2">
            A comunicação com este site usa HTTPS. O processador de pagamentos segue práticas da indústria para
            dados sensíveis de pagamento.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-zinc-500">
            <Link href="/termos" className="text-emerald-800 underline-offset-2 hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="text-emerald-800 underline-offset-2 hover:underline">
              Privacidade
            </Link>
            <span>
              Precisa de ajuda?{" "}
              {contatoMailto ? (
                <a href={contatoMailto} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                  Fale connosco
                </a>
              ) : (
                <Link href="/sobre" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                  Fale connosco
                </Link>
              )}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
