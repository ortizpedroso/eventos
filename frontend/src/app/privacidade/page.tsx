import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidade | EventosBR",
  description:
    "Como a EventosBR trata dados pessoais, cookies e integrações (ex.: provedores de pagamento), em linha com boas práticas e a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <div className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Documento legal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Política de privacidade
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Última atualização: julho de 2026.</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-justify">
              Esta política descreve quais dados coletamos, para que os utilizamos e quais são os seus direitos,
              nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">1. Quem é responsável</h2>
            <p className="mt-3 text-justify">
              O responsável pelo tratamento dos dados pessoais coletados através deste site e da respectiva API é
              a entidade que opera a marca EventosBR (a seguir, &quot;nós&quot; ou &quot;plataforma&quot;). Para
              exercer seus direitos, tirar dúvidas ou falar com o encarregado pelo tratamento de dados (DPO), use
              nosso{" "}
              <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
                formulário de contato
              </Link>{" "}
              — respondemos por e-mail o mais rápido possível.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">2. Que dados tratamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-justify">
              <li>
                <strong className="text-zinc-800">Conta e autenticação:</strong> nome, e-mail, tipo de
                usuário (ex.: organizador), identificadores técnicos e registro de sessão, quando aplicável.
              </li>
              <li>
                <strong className="text-zinc-800">Eventos:</strong> dados que o organizador insere (nome do
                evento, descrição, datas, local, preço, imagens, mensagens).
              </li>
              <li>
                <strong className="text-zinc-800">Compras e participantes:</strong> dados necessários para
                emitir o ingresso e cumprir obrigações legais (ex.: nome, e-mail, CPF ou telefone, quando
                solicitados no fluxo de compra).
              </li>
              <li>
                <strong className="text-zinc-800">Pagamento:</strong> dados de cartão e transação são
                tratados pela{" "}
                <strong className="text-zinc-800">
                  Asaas (instituição de pagamento autorizada pelo Banco Central do Brasil)
                </strong>
                . A plataforma recebe atualizações de status da transação e valores, mas nunca
                armazena o número completo do seu cartão nos próprios servidores.
              </li>
              <li>
                <strong className="text-zinc-800">Registros técnicos:</strong> endereço IP, tipo de navegador e
                logs de segurança, na medida necessária para operar e proteger o serviço.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">3. Finalidades e bases legais (LGPD)</h2>
            <p className="mt-3 text-justify">
              Tratamos dados para executar o contrato ou procedimentos pré-contratuais (criar conta, publicar
              evento, processar compra), para cumprir obrigações legais, por legítimo interesse (segurança,
              prevenção de fraude, melhoria do serviço) e, quando exigido, com base no consentimento (ex.:
              comunicações opcionais).
            </p>
            <p className="mt-3 text-justify">
              <strong className="text-zinc-800">Comunicações de marketing da EventosBR</strong> (novidades,
              eventos na plataforma, dicas) só são enviadas por e-mail ou WhatsApp se você marcar a opção no
              cadastro ou no perfil. Você pode revogar o consentimento a qualquer momento. Isso é independente dos
              e-mails transacionais (ingresso, confirmação) e dos avisos que o organizador envia aos participantes
              do próprio evento.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">4. Compartilhamento com terceiros</h2>
            <p className="mt-3 text-justify">
              Compartilhamos dados com prestadores estritamente necessários à operação do serviço, em
              especial a Asaas (pagamentos) e a infraestrutura (hospedagem, banco de dados, envio de
              e-mail), sempre com salvaguardas contratuais.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">5. Retenção</h2>
            <p className="mt-3 text-justify">
              Conservamos os dados pelo tempo necessário para prestar o serviço, cumprir obrigações legais
              (ex.: fiscais) e resolver eventuais disputas. Depois disso, eliminamos ou anonimizamos, salvo
              quando exista base legal para conservação mais prolongada.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">6. Cookies e tecnologias similares</h2>
            <p className="mt-3 text-justify">
              O site pode utilizar cookies ou armazenamento local para sessão, preferências e segurança.
              Cookies estritamente necessários não dependem de consentimento; outros, se forem introduzidos no
              futuro, serão geridos conforme a legislação aplicável.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">7. Seus direitos</h2>
            <p className="mt-3 text-justify">
              Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização,
              eliminação, portabilidade, informação sobre compartilhamentos e revogação de consentimento, quando
              aplicável. Basta usar nosso{" "}
              <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
                formulário de contato
              </Link>
              . Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8" id="denunciar">
            <h2 className="text-lg font-semibold text-zinc-900">8. Denúncias e conteúdo abusivo</h2>
            <p className="mt-3 text-justify">
              Se você notar um evento fraudulento, conteúdo ilegal, uso indevido de identidade ou qualquer outro
              comportamento suspeito, avise a gente com o máximo de detalhe possível (URL do evento, capturas de
              tela, datas) pelo nosso{" "}
              <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
                formulário de contato
              </Link>
              . Analisamos toda denúncia com atenção.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">9. Segurança</h2>
            <p className="mt-3 text-justify">
              Aplicamos medidas técnicas e organizacionais adequadas ao risco, incluindo conexões criptografadas
              (HTTPS) e o princípio do mínimo acesso interno. Nenhum sistema é infalível; recomendamos boas
              práticas de senha e dispositivos atualizados.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">10. Alterações a esta política</h2>
            <p className="mt-3 text-justify">
              Podemos atualizar esta política para refletir mudanças legais ou do produto. A data no topo
              indica a última revisão relevante.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">Ficou com alguma dúvida?</h2>
            <p className="mt-3 text-justify">
              Não deixamos você sem resposta: qualquer dúvida sobre privacidade, seus dados ou esta política,
              fale com a gente pelo{" "}
              <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
                formulário de contato
              </Link>
              .
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-700 underline-offset-2 hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
