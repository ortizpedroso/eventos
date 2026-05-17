import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de uso | EventosBR",
  description:
    "Termos e condições de uso da plataforma EventosBR para organizadores e participantes.",
};

export default function TermosPage() {
  return (
    <div className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Documento legal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Termos de uso
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Última atualização: maio de 2026.</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-justify">
              Ao aceder ou utilizar a EventosBR, concorda com estes termos. Se não concordar, não utilize a
              plataforma.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">1. Serviço</h2>
            <p className="mt-3 text-justify">
              A EventosBR é uma plataforma online que permite a organizadores criar páginas de eventos, definir
              preços de ingresso e, quando configurado, receber pagamentos através de gateways financeiros 
              externos e rigorosamente homologados. A plataforma não substitui assessoria jurídica, fiscal 
              ou contabilidade do organizador.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">2. Contas e responsabilidades</h2>
            <p className="mt-3 text-justify">
              É responsável pela veracidade dos dados da sua conta e pela segurança das credenciais. O
              organizador é responsável pelo conteúdo do evento (textos, imagens, preços, datas, local e
              cumprimento da legislação aplicável, incluindo oferta ao público e proteção de dados dos
              participantes).
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">3. Participantes e compras</h2>
            <p className="mt-3 text-justify">
              Ao comprar um ingresso, o participante aceita as condições do evento indicadas na respetiva página
              e as políticas de cancelamento ou reembolso definidas pelo organizador e pela plataforma, quando
              aplicável. Pagamentos são processados pelo prestador integrado; prazos e disputas podem seguir as
              regras desse prestador e da legislação.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">4. Uso aceitável</h2>
            <p className="mt-3 text-justify">
              É proibido utilizar a plataforma para fins ilegais, para disseminar malware, para burlar limites
              técnicos ou para prejudicar outros utilizadores. Reservamo-nos o direito de suspender contas ou
              eventos que violem estes termos ou a lei.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">5. Disponibilidade e alterações</h2>
            <p className="mt-3 text-justify">
              Procuramos manter o serviço disponível, mas não garantimos funcionamento ininterrupto. Podemos
              alterar funcionalidades ou estes termos; alterações relevantes serão indicadas na plataforma ou
              por meios adequados. O uso continuado após alterações constitui aceitação atualizada, salvo
              disposição legal em contrário.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">6. Limitação de responsabilidade</h2>
            <p className="mt-3 text-justify">
              Na medida permitida pela lei aplicável, a EventosBR não responde por danos indiretos, lucros
              cessantes ou perdas decorrentes de eventos organizados por terceiros, falhas de redes ou de
              prestadores de pagamento, ou de uso incorreto da plataforma. O relacionamento contratual principal
              entre participante e organizador mantém-se entre essas partes no que respeita ao evento em si.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">7. Propriedade intelectual</h2>
            <p className="mt-3 text-justify">
              A marca, o software e os conteúdos próprios da plataforma pertencem aos respetivos titulares. O
              organizador concede licença necessária para exibir o conteúdo do evento na plataforma durante a
              utilização do serviço.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">8. Lei e foro</h2>
            <p className="mt-3 text-justify">
              Estes termos regem-se pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca
              da sede da empresa titular da plataforma, salvo norma consumerista imperativa em contrário.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">9. Contacto</h2>
            <p className="mt-3 text-justify">
              Questões sobre estes termos podem ser enviadas através dos meios indicados na página{" "}
              <Link href="/sobre" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                Sobre
              </Link>{" "}
              ou no endereço de contacto público, quando publicado.
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-800 underline-offset-2 hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
